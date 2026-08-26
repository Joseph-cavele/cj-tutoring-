'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { getAuthorizedUser } from '@/lib/auth/guard';
import {
  BookingError,
  adminSetBookingStatus,
  cancelBooking,
  createBooking,
  decideBooking,
} from '@/services/lesson-booking.service';
import { replaceTutorAvailability } from '@/services/availability.service';
import { ParentError, addChildForParent } from '@/services/parent.service';
import { tutorProfileFor } from '@/lib/booking/access';
import {
  addChildSchema,
  adminStatusSchema,
  cancelBookingSchema,
  createBookingSchema,
  decideBookingSchema,
  saveAvailabilitySchema,
} from '@/validations/lesson-booking';

/**
 * Server actions for the booking flow.
 *
 * Each one repeats the whole check - session, role, ownership - because an
 * action is a public HTTP endpoint that anything can call, not just the
 * component that renders the button (brief section 15).
 *
 * Failures come back as values rather than exceptions so a form can show a
 * message instead of hitting an error boundary.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string; issues?: { field: string; message: string }[] };

function failure(error: string): ActionResult<never> {
  return { ok: false, error };
}

/** Turns a thrown service error into a value the UI can render. */
function fromError(error: unknown): ActionResult<never> {
  if (error instanceof BookingError) return failure(error.message);

  console.error('[booking action] unexpected error', error);
  return failure('Something went wrong. Please try again.');
}

const paths = {
  student: '/student/dashboard',
  parent: '/parent/dashboard',
  tutor: '/tutor/dashboard',
  admin: '/admin/dashboard',
};

/** Both sides of a booking need refreshing after any change. */
function revalidateBookingViews() {
  for (const path of Object.values(paths)) revalidatePath(path);
  revalidatePath('/booking');
}

export async function createBookingAction(
  input: unknown
): Promise<
  ActionResult<{
    bookingId: string;
    requiresPayment: boolean;
    amount: number;
    currency: string;
  }>
> {
  // Tutors are excluded here as well as in the service: a booking is something
  // done for a student, not by a teacher.
  const user = await getAuthorizedUser(['student', 'parent', 'admin']);

  if (!user) return failure('Please sign in to book a lesson');

  const parsed = createBookingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the booking details and try again',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    const result = await createBooking(user, parsed.data);
    revalidateBookingViews();

    return {
      ok: true,
      data: {
        bookingId: result.bookingId,
        requiresPayment: result.requiresPayment,
        amount: result.amount,
        currency: result.currency,
      },
    };
  } catch (error) {
    return fromError(error);
  }
}

/** Tutor accepts or rejects. Rule 7: only the assigned tutor. */
export async function decideBookingAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser('tutor');

  if (!user) return failure('Only a tutor can answer a booking request');

  const parsed = decideBookingSchema.safeParse(input);

  if (!parsed.success) return failure('That request is not valid');

  try {
    await decideBooking(user, parsed.data);
    revalidateBookingViews();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function cancelBookingAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser();

  if (!user) return failure('Please sign in');

  const parsed = cancelBookingSchema.safeParse(input);

  if (!parsed.success) return failure('That request is not valid');

  try {
    await cancelBooking(user, parsed.data);
    revalidateBookingViews();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function adminSetBookingStatusAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser('admin');

  if (!user) return failure('Only an admin can do that');

  const parsed = adminStatusSchema.safeParse(input);

  if (!parsed.success) return failure('That request is not valid');

  try {
    await adminSetBookingStatus(user, parsed.data);
    revalidateBookingViews();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/** A tutor edits their own weekly availability, and nobody else's. */
export async function saveAvailabilityAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser('tutor');

  if (!user) return failure('Only a tutor can set availability');

  const parsed = saveAvailabilitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check your availability and try again',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const tutor = await tutorProfileFor(user.id);

  if (!tutor) return failure('Your tutor profile is not set up yet');

  try {
    await replaceTutorAvailability(tutor._id.toString(), parsed.data.windows);
    revalidatePath('/tutor/availability');
    revalidatePath(paths.tutor);
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/**
 * A parent adds a child to their own account.
 *
 * The parent is resolved from the session, so a parent can only ever add a
 * child to themselves - there is no parentId in the input to point elsewhere.
 */
export async function addChildAction(
  input: unknown
): Promise<ActionResult<{ studentId: string; name: string; invited: boolean }>> {
  const user = await getAuthorizedUser('parent');

  if (!user) return failure('Only a parent can add a child');

  const parsed = addChildSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the details and try again',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  // The invite link must be absolute and point at the deployment the parent is
  // actually using, so it comes from the request rather than a constant.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = process.env.NEXTAUTH_URL ?? (host ? `${protocol}://${host}` : '');

  try {
    const result = await addChildForParent({
      userId: user.id,
      input: parsed.data,
      origin,
    });

    revalidateBookingViews();

    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof ParentError) return failure(error.message);
    return fromError(error);
  }
}
