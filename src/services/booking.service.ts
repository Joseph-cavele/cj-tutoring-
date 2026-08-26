import { connectDB } from '@/lib/mongodb';
import { BookingRequest } from '@/models/BookingRequest';
import { EmailNotConfiguredError, sendMail } from '@/lib/email/mailer';
import { SUBJECTS } from '@/lib/curriculum';
import type { BookingInput } from '@/validations/booking';

function subjectName(slug: string): string {
  return Object.values(SUBJECTS).find((subject) => subject.slug === slug)?.name ?? slug;
}

function modeLabel(mode: string): string {
  if (mode === 'in_person') return 'In person';
  if (mode === 'hybrid') return 'Either';
  return 'Online';
}

/**
 * Stores a trial request, then notifies the office.
 *
 * The record is saved first and on its own: an SMTP outage must not lose an
 * enquiry, so a failed notification is logged rather than thrown.
 */
export async function submitBooking(input: BookingInput) {
  await connectDB();

  const booking = await BookingRequest.create({
    name: input.name,
    email: input.email,
    phone: input.phone || undefined,
    subjectSlug: input.subjectSlug,
    grade: input.grade,
    mode: input.mode,
    preferredDate: new Date(`${input.preferredDate}T00:00:00`),
    preferredTime: input.preferredTime,
    notes: input.notes,
  });

  const text = [
    'New trial lesson request',
    '',
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    `Phone:   ${input.phone || 'not given'}`,
    `Subject: ${subjectName(input.subjectSlug)}`,
    `Grade:   ${input.grade}`,
    `Format:  ${modeLabel(input.mode)}`,
    `Wants:   ${input.preferredDate} at ${input.preferredTime}`,
    '',
    input.notes || '(no notes)',
  ].join('\n');

  try {
    await sendMail({
      subject: `Trial request: ${subjectName(input.subjectSlug)} Grade ${input.grade}`,
      text,
      replyTo: input.email,
    });
  } catch (error) {
    if (!(error instanceof EmailNotConfiguredError)) {
      console.error('[booking] notification failed', error);
    }
    // The request is already saved, so the visitor still gets a success reply.
  }

  return { id: booking._id.toString(), received: true };
}
