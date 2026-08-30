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

    const isLive = !key.startsWith('sk_test');
    record('Paystack', true, `authenticated, ${isLive ? 'LIVE mode' : 'test mode'}`);

    if (isLive) {
      console.log(
        `${YELLOW}  ! This is a LIVE key. Charges are real money.${RESET}`
      );
    }

    /**
     * The webhook URL is dashboard configuration, not an environment variable,
     * so nothing in this repo can verify it - and getting it wrong is silent.
     * The route is /api/webhooks/paystack and the natural mistake is to write
     * /api/paystack/webhook, which 404s. Since the webhook is the only thing
     * that settles a charge when the customer closes the browser after paying,
     * that mistake means money taken and lessons left unconfirmed.
     *
     * Printing the exact string to paste is the cheapest guard available.
     */
    const appUrl = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? '')
      .replace(/\/+$/, '');

    console.log(`${DIM}  Webhook URL to set in the Paystack dashboard:${RESET}`);
    console.log(
      `${DIM}    ${appUrl || 'https://<your-domain>'}/api/webhooks/paystack${RESET}`
    );
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

/* -------------------------------- Resend ------------------------------- */

async function checkResend() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;

  if (!configured(key)) return record('Resend', null, 'not configured');

  if (!configured(from)) {
    return record('Resend', false, 'RESEND_API_KEY is set but FROM_EMAIL is not');
  }

  // Bare address, or "Name <address>" - only the address is checked here.
  const address = from.includes('<') ? from.split('<')[1].replace('>', '').trim() : from.trim();
  const domain = address.split('@')[1];

  try {
    // Read-only: lists the verified domains. Nothing is sent or charged.
    const response = await fetch('https://api.resend.com/domains', {
      headers: { authorization: `Bearer ${key}` },
    });

    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      // A send-only key legitimately cannot list domains. That is a working
      // key with narrow permissions, not a broken one, so it is not a failure
      // - but the From domain cannot be checked, so say so.
      if (payload.name === 'restricted_api_key') {
        return record('Resend', true, `key valid (send-only, cannot verify ${domain})`);
      }

      return record('Resend', false, payload.message ?? `HTTP ${response.status}`);
    }

    if (!response.ok) {
      return record('Resend', false, payload.message ?? `HTTP ${response.status}`);
    }

    const domains = payload.data ?? [];
    const match = domains.find((entry) => entry.name === domain);

    if (!match) {
      const known = domains.map((entry) => entry.name).join(', ') || 'none';
      return record(
        'Resend',
        false,
        `key valid, but "${domain}" is not a domain on this account (has: ${known}). Resend will refuse to send from ${address}.`
      );
    }

    if (match.status !== 'verified') {
      return record(
        'Resend',
        false,
        `key valid, but "${domain}" is ${match.status} - finish its DNS records before sending`
      );
    }

    record('Resend', true, `key valid, sending as ${address}`);
  } catch (error) {
    record('Resend', false, error.message);
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
await checkResend();
await checkAi();

const failed = results.filter((result) => result.ok === false);
const skipped = results.filter((result) => result.ok === null);

console.log(
  `\n${results.length - failed.length - skipped.length} working, ${failed.length} failing, ${skipped.length} not configured.`
);

process.exit(failed.length > 0 ? 1 : 0);
