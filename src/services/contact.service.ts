import { EmailNotConfiguredError, sendMail } from '@/lib/email/mailer';
import type { ContactInput } from '@/validations/contact';

export class ContactError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ContactError';
  }
}

/** Keeps user-supplied text out of the HTML body as markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Delivers a website enquiry to the CJ inbox.
 *
 * Business logic lives here rather than in the route handler, per CLAUDE.md
 * section 27.
 */
export async function submitEnquiry(input: ContactInput) {
  const { name, email, subject, message } = input;

  const text = [
    `New enquiry from the website`,
    ``,
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Subject: ${subject}`,
    ``,
    message,
  ].join('\n');

  const html = `
    <p><strong>New enquiry from the website</strong></p>
    <p>
      <strong>Name:</strong> ${escapeHtml(name)}<br />
      <strong>Email:</strong> ${escapeHtml(email)}<br />
      <strong>Subject:</strong> ${escapeHtml(subject)}
    </p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    await sendMail({
      subject: `Website enquiry: ${subject}`,
      text,
      html,
      // Replying in Gmail then goes straight to the parent or student.
      replyTo: email,
    });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      throw new ContactError(
        'Message could not be sent right now. Please email or call us instead.',
        503
      );
    }

    throw error;
  }

  return { delivered: true };
}
