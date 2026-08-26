import { CONTACT } from '@/lib/contact';

/**
 * One transactional email layout, shared by every notification.
 *
 * Callers describe an email as content - a heading, some paragraphs, a table
 * of details, one call to action - and get back the plain-text and HTML parts
 * together, so the two can never drift apart. Gmail and Outlook both strip
 * <style> blocks, so everything here is inline and table-free where it can be.
 */

/** Brand palette, from Design.md. Only blue and amber, no third hue. */
const COLOR = {
  blue: '#1B4FD8',
  navy: '#152A5E',
  slate: '#5A6785',
  cream: '#FDFBF5',
  border: '#D8E3FB',
  tint: '#EEF3FE',
} as const;

/** Keeps user-supplied text out of the HTML body as markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Absolute base for links in an email.
 *
 * An email is read outside the request that produced it, so a relative path is
 * useless: callers that have a request origin pass it, and everything else
 * falls back to the configured site URL.
 */
export function appUrl(origin?: string): string {
  const base = origin || process.env.NEXTAUTH_URL || '';
  return base.replace(/\/$/, '');
}

/** A labelled fact - subject, date, amount - rendered as a definition row. */
export type EmailDetail = { label: string; value: string };

export type EmailContent = {
  /** Large line at the top of the card. */
  heading: string;
  /** "Hi Thabo," - omitted for office-facing mail. */
  greeting?: string;
  /** Paragraphs before the details table. */
  intro?: string[];
  details?: EmailDetail[];
  cta?: { label: string; url: string };
  /** Paragraphs after the details table. */
  outro?: string[];
};

export type RenderedEmail = { text: string; html: string };

function renderText(content: EmailContent): string {
  const lines: string[] = [];

  if (content.greeting) lines.push(content.greeting, '');

  lines.push(content.heading, '');

  for (const paragraph of content.intro ?? []) lines.push(paragraph, '');

  if (content.details?.length) {
    // Padded so the values line up in a monospaced mail client.
    const width = Math.max(...content.details.map((detail) => detail.label.length));

    for (const detail of content.details) {
      lines.push(`${detail.label.padEnd(width)}  ${detail.value}`);
    }

    lines.push('');
  }

  if (content.cta) lines.push(`${content.cta.label}: ${content.cta.url}`, '');

  for (const paragraph of content.outro ?? []) lines.push(paragraph, '');

  lines.push(
    '--',
    'CJ Private Tutoring',
    CONTACT.email,
    CONTACT.phone.display
  );

  return lines.join('\n');
}

function renderDetails(details: EmailDetail[]): string {
  const rows = details
    .map(
      (detail) => `
        <tr>
          <td style="padding:6px 16px 6px 0;color:${COLOR.slate};font-size:14px;vertical-align:top">${escapeHtml(detail.label)}</td>
          <td style="padding:6px 0;color:${COLOR.navy};font-size:14px;font-weight:600">${escapeHtml(detail.value)}</td>
        </tr>`
    )
    .join('');

  return `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background:${COLOR.tint};border-radius:10px;padding:12px 16px">
        ${rows}
      </table>`;
}

function renderParagraphs(paragraphs: string[] | undefined): string {
  return (paragraphs ?? [])
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;color:${COLOR.navy};font-size:15px;line-height:1.6">${escapeHtml(paragraph)}</p>`
    )
    .join('');
}

function renderHtml(content: EmailContent): string {
  const cta = content.cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.cta.url)}" style="display:inline-block;background:${COLOR.blue};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px">${escapeHtml(content.cta.label)}</a></p>`
    : '';

  return `
<div style="margin:0;padding:24px 12px;background:${COLOR.cream};font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${COLOR.border};border-radius:14px;padding:28px">
    <p style="margin:0 0 20px;color:${COLOR.blue};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">CJ Private Tutoring</p>
    <h1 style="margin:0 0 16px;color:${COLOR.navy};font-size:21px;line-height:1.3">${escapeHtml(content.heading)}</h1>
    ${content.greeting ? `<p style="margin:0 0 14px;color:${COLOR.navy};font-size:15px">${escapeHtml(content.greeting)}</p>` : ''}
    ${renderParagraphs(content.intro)}
    ${content.details?.length ? renderDetails(content.details) : ''}
    ${cta}
    ${renderParagraphs(content.outro)}
    <hr style="border:none;border-top:1px solid ${COLOR.border};margin:24px 0 16px" />
    <p style="margin:0;color:${COLOR.slate};font-size:13px;line-height:1.6">
      CJ Private Tutoring<br />
      <a href="mailto:${CONTACT.email}" style="color:${COLOR.blue};text-decoration:none">${CONTACT.email}</a><br />
      <a href="tel:${CONTACT.phone.e164}" style="color:${COLOR.blue};text-decoration:none">${CONTACT.phone.display}</a>
    </p>
  </div>
</div>`;
}

export function renderEmail(content: EmailContent): RenderedEmail {
  return { text: renderText(content), html: renderHtml(content) };
}

/** "R1 250.00" - the amounts in these emails are all gateway currency. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount);
  } catch {
    // An unknown currency code must not stop a receipt going out.
    return `${currency} ${amount.toFixed(2)}`;
  }
}
