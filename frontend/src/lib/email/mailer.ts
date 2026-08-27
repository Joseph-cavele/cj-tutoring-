import { Resend } from 'resend';

import { CONTACT } from '@/lib/contact';

/**
 * Resend transport (CLAUDE.md section 23).
 *
 * Server-only. RESEND_API_KEY must never reach the browser, so nothing in
 * this folder may be imported from a client component.
 *
 * FROM_EMAIL has to be an address on a domain verified in the Resend
 * dashboard - Resend refuses to send from anything else, which is what stops
 * the platform being used to spoof another sender.
 */
let client: Resend | null = null;

export class EmailNotConfiguredError extends Error {
  constructor(detail?: string) {
    super(
      detail ??
        'Email is not configured. Set RESEND_API_KEY and FROM_EMAIL in .env.local'
    );
    this.name = 'EmailNotConfiguredError';
  }
}

/** Placeholder values from .env.example count as unconfigured. */
function usable(value?: string): boolean {
  return Boolean(value && !value.startsWith('your_'));
}

export function isEmailConfigured(): boolean {
  return usable(process.env.RESEND_API_KEY) && usable(process.env.FROM_EMAIL);
}

function getClient(): Resend {
  if (client) return client;

  if (!isEmailConfigured()) throw new EmailNotConfiguredError();

  client = new Resend(process.env.RESEND_API_KEY);

  return client;
}

/**
 * The From header.
 *
 * FROM_EMAIL may be a bare address or already carry a display name, so a
 * value like "CJ Private Tutoring <hello@cj.co.za>" is passed through rather
 * than being wrapped a second time into something Resend rejects.
 */
function fromAddress(): string {
  const configured = (process.env.FROM_EMAIL ?? '').trim();

  if (configured.includes('<')) return configured;

  return `CJ Private Tutoring <${configured}>`;
}

export type SendMailOptions = {
  to?: string;
  subject: string;
  text: string;
  html?: string;
  /** Set so a reply goes to the enquirer rather than back to our own inbox. */
  replyTo?: string;
};

/**
 * Error codes that mean our configuration is wrong, not this message.
 *
 * A revoked key or an unverified From domain is a fault with the deployment.
 * Callers already handle EmailNotConfiguredError by telling the visitor to
 * phone instead, so these are treated the same rather than becoming a 500.
 */
const CONFIG_ERRORS = new Set([
  'missing_api_key',
  'invalid_api_key',
  'restricted_api_key',
  'invalid_from_address',
  'invalid_access',
]);

export async function sendMail({ to, subject, text, html, replyTo }: SendMailOptions) {
  const resend = getClient();

  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: to ?? CONTACT.email,
    subject,
    text,
    html,
    replyTo,
  });

  // Resend reports a rejected send in the payload rather than by throwing, so
  // an unchecked call would look successful while nothing was delivered.
  if (error) {
    if (CONFIG_ERRORS.has(error.name)) {
      console.error('[mailer] Resend rejected our configuration', error);
      throw new EmailNotConfiguredError(`Resend: ${error.message}`);
    }

    throw new Error(`Resend refused the message (${error.name}): ${error.message}`);
  }

  return { id: data?.id };
}
