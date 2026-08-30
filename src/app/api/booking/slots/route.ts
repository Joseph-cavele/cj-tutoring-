import { NextResponse } from 'next/server';

import { getCapableUser } from '@/lib/auth/guard';
import { getAvailableSlots, getSlotMinutesForDate } from '@/services/availability.service';
import { resolveBookingActor, BookingAccessError } from '@/lib/booking/access';
import { slotQuerySchema, objectId } from '@/validations/lesson-booking';

/**
 * Free slots for a tutor on a date.
 *
 * The student is resolved through the same ownership check the booking itself
 * uses, so the "already busy" filter cannot be pointed at someone else's
 * calendar to discover when they have lessons.
 */
export async function GET(request: Request) {
  const user = await getCapableUser('bookings:create');

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  const parsed = slotQuerySchema.safeParse({
    tutorId: params.get('tutorId'),
    date: params.get('date'),
    teachingMode: params.get('teachingMode') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a tutor and a date' }, { status: 400 });
  }

  const requestedStudent = params.get('studentId');
  const studentIdInput = objectId.safeParse(requestedStudent);

  try {
    const actor = await resolveBookingActor(
      user,
      studentIdInput.success ? studentIdInput.data : undefined
    );

    const [slots, slotMinutes] = await Promise.all([
      getAvailableSlots({
        tutorId: parsed.data.tutorId,
        isoDate: parsed.data.date,
        teachingMode: parsed.data.teachingMode,
        studentId: actor.studentId,
      }),
      getSlotMinutesForDate({
        tutorId: parsed.data.tutorId,
        isoDate: parsed.data.date,
        teachingMode: parsed.data.teachingMode,
      }),
    ]);

    return NextResponse.json({ slots, slotMinutes });
  } catch (error) {
    if (error instanceof BookingAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[api/booking/slots] failed', error);
    return NextResponse.json({ error: 'Could not load available times' }, { status: 500 });
  }
}
