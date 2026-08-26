// Standalone third-party connectivity check.
// Run with: npm run check:services
//
// Every call here is read-only or a token mint - nothing is created, charged
// or emailed. Credentials are never printed, only whether they worked.

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok === true ? `${GREEN}✔` : ok === null ? `${YELLOW}—` : `${RED}✖`;
  console.log(`${mark} ${name}${RESET} ${DIM}${detail}${RESET}`);
}

/** Treats .env.example placeholders as "not configured" rather than "broken". */
function configured(...values) {
  return values.every((value) => value && !value.startsWith('your_'));
}

/* ------------------------------- Paystack ------------------------------ */

async function checkPaystack() {
  const key = process.env.PAYSTACK_SECRET_KEY;

  if (!configured(key)) return record('Paystack', null, 'not configured');

  try {
    // Read-only: lists at most one transaction.
    const response = await fetch('https://api.paystack.co/transaction?perPage=1', {
      headers: { authorization: `Bearer ${key}` },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.status) {
      return record('Paystack', false, payload.message ?? `HTTP ${response.status}`);
    }

    const mode = key.startsWith('sk_test') ? 'test mode' : 'LIVE mode';
    record('Paystack', true, `authenticated, ${mode}`);
  } catch (error) {
    record('Paystack', false, error.message);
  }
}

/* --------------------------------- Zoom -------------------------------- */

async function checkZoom() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!configured(accountId, clientId, clientSecret)) {
    return record('Zoom', null, 'not configured');
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      { method: 'POST', headers: { authorization: `Basic ${basic}` } }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.access_token) {
      return record('Zoom', false, payload.reason ?? payload.message ?? `HTTP ${response.status}`);
    }

    // What the platform actually does with Zoom is create a meeting when a
    // lesson is accepted and delete it when one is cancelled. The token Zoom
    // just issued carries the granted scopes, so the capability is checked
    // from that rather than by calling an endpoint - listing meetings needs a
    // read scope the app never uses, and failing on it reported a working
    // integration as broken.
    const granted = new Set(String(payload.scope ?? '').split(/[\s,]+/).filter(Boolean));

    // Zoom issues granular scopes to newer apps and classic ones to older
    // apps, so either spelling counts.
    const needed = [
      { what: 'create meetings', any: ['meeting:write:meeting:admin', 'meeting:write:admin'] },
      { what: 'delete meetings', any: ['meeting:delete:meeting:admin', 'meeting:delete:admin'] },
    ];

    const missing = needed.filter((scope) => !scope.any.some((name) => granted.has(name)));

    if (missing.length > 0) {
      return record(
        'Zoom',
        false,
        `token issued, but the app cannot ${missing.map((scope) => scope.what).join(' or ')}. Add ${missing
          .map((scope) => scope.any[0])
          .join(' and ')} in the Zoom Marketplace app, then activate it again.`
      );
    }

    record('Zoom', true, `token issued, meeting scopes granted (${granted.size} in total)`);
  } catch (error) {
    record('Zoom', false, error.message);
  }
}

/* ------------------------------ Cloudinary ----------------------------- */

async function checkCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!configured(cloudName, apiKey, apiSecret)) {
    return record('Cloudinary', null, 'not configured');
  }

  try {
    const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
      headers: { authorization: `Basic ${basic}` },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return record(
        'Cloudinary',
        false,
        payload.error?.message ?? `HTTP ${response.status}`
      );
    }

    record('Cloudinary', true, `ping ${payload.status ?? 'ok'} (cloud: ${cloudName})`);
  } catch (error) {
    record('Cloudinary', false, error.message);
  }
}

/* --------------------------------- Gmail ------------------------------- */

async function checkGmail() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!configured(user, pass)) return record('Gmail SMTP', null, 'not configured');

  try {
    const { default: nodemailer } = await import('nodemailer');

    const transport = nodemailer.createTransport({
      service: 'gmail',
      // App passwords are 16 characters; Google shows them in groups of four,
      // but the spaces are not part of the password.
      auth: { user, pass: pass.replace(/\s+/g, '') },
    });

    // verify() authenticates and disconnects. It does not send anything.
    await transport.verify();
    record('Gmail SMTP', true, `authenticated as ${user}`);
  } catch (error) {
    record('Gmail SMTP', false, error.message);
  }
}

/* ------------------------------ Google AI ------------------------------ */

async function checkAi() {
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL ?? 'gemini-3.6-flash';

  if (!configured(key)) return record('Google AI', null, 'not configured');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }] }),
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return record(
        'Google AI',
        false,
        payload.error?.message?.slice(0, 160) ?? `HTTP ${response.status}`
      );
    }

    record('Google AI', true, `${model} responded`);
  } catch (error) {
    record('Google AI', false, error.message);
  }
}

/* --------------------------------- Run --------------------------------- */

console.log(`${DIM}Checking third-party services (read-only)...${RESET}\n`);

await checkPaystack();
await checkZoom();
await checkCloudinary();
await checkGmail();
await checkAi();

const failed = results.filter((result) => result.ok === false);
const skipped = results.filter((result) => result.ok === null);

console.log(
  `\n${results.length - failed.length - skipped.length} working, ${failed.length} failing, ${skipped.length} not configured.`
);

process.exit(failed.length > 0 ? 1 : 0);
