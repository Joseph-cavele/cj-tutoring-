import nodemailer, { type Transporter } from 'nodemailer';

import { CONTACT } from '@/lib/contact';

/**
 * Gmail SMTP transport (CLAUDE.md section 23).
 *
 * Server-only. GMAIL_APP_PASSWORD is a Google App Password, not the account
 * password - Google has rejected plain passwords for SMTP since 2022, and the
 * account needs 2FA switched on before one can be generated.
 */
let transporter: Transporter | null = null;

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local');
    this.name = 'EmailNotConfiguredError';
  }
}

export function getTransporter(): Transporter {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass || pass.startsWith('your_')) {
    throw new EmailNotConfiguredError();
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
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
 * True when Gmail rejected the credentials rather than the message.
 *
 * A revoked or mistyped app password produces EAUTH / 535, which is a
 * configuration fault, not a fault with this enquiry. Callers already handle
 * EmailNotConfiguredError by telling the visitor to phone instead, so the two
 * are treated the same and a bad password does not become a 500.
 */
function isAuthFailure(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const response = String((error as { response?: string } | null)?.response ?? '');
  return code === 'EAUTH' || response.startsWith('535');
}

export async function sendMail({ to, subject, text, html, replyTo }: SendMailOptions) {
  const transport = getTransporter();

  try {
    return await sendVia(transport, { to, subject, text, html, replyTo });
  } catch (error) {
    if (isAuthFailure(error)) {
      console.error('[mailer] Gmail rejected the app password', error);
      throw new EmailNotConfiguredError();
    }

    throw error;
  }
}

function sendVia(transport: Transporter, { to, subject, text, html, replyTo }: SendMailOptions) {
  return transport.sendMail({
    from: `"CJ Private Tutoring" <${process.env.GMAIL_USER}>`,
    to: to ?? CONTACT.email,
    subject,
    text,
    html,
    replyTo,
  });
}
