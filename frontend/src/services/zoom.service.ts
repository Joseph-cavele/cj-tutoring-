import { connectDB } from '@/lib/mongodb';
import { Booking, ZoomMeeting } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { bookingScopeFor, tutorProfileFor } from '@/lib/booking/access';
import { ATTENDANCE_ALLOWED } from '@/lib/booking/constants';
import { SAST_OFFSET_MINUTES, toMinutes } from '@/lib/availability/slots';
import { createMeeting, deleteMeeting, isZoomConfigured } from '@/lib/zoom/client';

/**
 * Zoom meetings for lessons (brief section 2 of the second brief).
 *
 * The platform stores meeting details and decides who may see which link. It
 * builds no video infrastructure of its own (CLAUDE.md section 8).
 */

/**
 * The absolute instant a lesson starts.
 *
 * A booking stores a calendar day plus a wall-clock time in SAST. Zoom needs a
 * real instant, so the two are combined here rather than letting the server's
 * own timezone decide what "14:00" meant.
 */
function lessonStartInstant(date: Date, startTime: string): Date {
  const dayStartUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  return new Date(dayStartUtc + (toMinutes(startTime) - SAST_OFFSET_MINUTES) * 60_000);
}

/**
 * Creates the meeting for a lesson that has just been accepted.
 *
 * Only for online lessons - an in-person lesson has nothing to join. Returns
 * null rather than throwing when Zoom is not configured or refuses, because a
 * tutor accepting a booking must not fail because of a third-party outage; the
 * lesson is still confirmed and the link can be added later.
 */
export async function createMeetingForBooking(bookingId: string) {
  await connectDB();

  const booking = await Booking.findById(bookingId)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .populate<{ student: { user?: { name?: string } } }>({
      path: 'student',
      select: 'user',
      populate: { path: 'user', select: 'name' },
    });

  if (!booking) return null;

  // In-person lessons and already-provisioned ones need nothing.
  if (booking.teachingMode === 'in_person') return null;
  if (booking.zoomMeeting) return null;
  if (booking.status !== 'accepted') return null;

  if (!isZoomConfigured()) {
    console.warn('[zoom] not configured; booking accepted without a meeting link');
    return null;
  }

  const studentName = booking.student?.user?.name ?? 'Student';
  const subjectName = booking.subject?.name ?? 'Tutoring';

  try {
    const meeting = await createMeeting({
      topic: `${subjectName} with ${studentName}`,
      startsAt: lessonStartInstant(booking.date, booking.startTime),
      durationMinutes: booking.durationMinutes,
      agenda: booking.notes ?? undefined,
    });

    const record = await ZoomMeeting.create({
      booking: booking._id,
      meetingId: meeting.meetingId,
      joinUrl: meeting.joinUrl,
      startUrl: meeting.startUrl,
      password: meeting.password,
      startsAt: lessonStartInstant(booking.date, booking.startTime),
      durationMinutes: booking.durationMinutes,
    });

    booking.zoomMeeting = record._id;
    await booking.save();

    return { meetingId: record.meetingId };
  } catch (error) {
    // Logged, not thrown: the acceptance already succeeded.
    console.error('[zoom] could not create meeting for booking', bookingId, error);
    return null;
  }
}

/** Removes the meeting when a lesson is called off. Best effort. */
export async function cancelMeetingForBooking(bookingId: string) {
  await connectDB();

  const booking = await Booking.findById(bookingId).select('zoomMeeting');

  if (!booking?.zoomMeeting) return;

  const meeting = await ZoomMeeting.findById(booking.zoomMeeting).select('meetingId');

  if (!meeting) return;

  if (isZoomConfigured()) {
    try {
      await deleteMeeting(meeting.meetingId);
    } catch (error) {
      console.error('[zoom] could not delete meeting', meeting.meetingId, error);
    }
  }

  await ZoomMeeting.deleteOne({ _id: meeting._id });
  booking.zoomMeeting = null;
  await booking.save();
}

export type MeetingAccess = {
  /** Where this viewer should go. The host link for the tutor, join for others. */
  url: string;
  isHost: boolean;
  startsAt: string;
  durationMinutes: number;
  /** Only ever populated for the host. */
  passcode: string | null;
};

/**
 * The meeting link this particular viewer is entitled to.
 *
 * Two separate checks, both server-side: the booking must be one this user is
 * party to, and only the assigned tutor receives the start URL. Students and
 * parents get the join URL and never see the passcode or host link, whatever
 * the UI asks for.
 */
export async function getMeetingForViewer(
  user: SessionUser,
  bookingId: string
): Promise<MeetingAccess | null> {
  await connectDB();

  // Ownership first: this returns nothing for a booking the user is not on.
  const scope = await bookingScopeFor(user);
  const booking = await Booking.findOne({ _id: bookingId, ...scope })
    .select('zoomMeeting tutor status teachingMode paymentStatus')
    .lean();

  if (!booking?.zoomMeeting) return null;

  // A link is only useful once the lesson is actually going ahead.
  if (booking.status !== 'accepted') return null;

  const isTutorOnThisBooking = await (async () => {
    if (user.role !== 'tutor') return false;
    const tutor = await tutorProfileFor(user.id);
    return Boolean(tutor && tutor._id.toString() === booking.tutor.toString());
  })();

  /**
   * The joining link is the lesson, so it is the last gate on payment.
   *
   * A lesson is accepted only once payment has settled, but it can stop being
   * settled afterwards - a refund, or a chargeback recorded by the tutor - and
   * an accepted booking would otherwise keep handing out its link. A plan
   * booking passes on `covered`, which is what lets a monthly student join
   * without paying again.
   *
   * The tutor is never blocked: they are the one who would have to explain the
   * problem, and they cannot do that from outside the room.
   */
  if (!isTutorOnThisBooking && !ATTENDANCE_ALLOWED.includes(booking.paymentStatus)) {
    return null;
  }

  // The host fields are select:false, so they are only fetched for the host.
  const meeting = isTutorOnThisBooking
    ? await ZoomMeeting.findById(booking.zoomMeeting)
        .select('+startUrl +password')
        .lean()
    : await ZoomMeeting.findById(booking.zoomMeeting).lean();

  if (!meeting) return null;

  return {
    url: isTutorOnThisBooking ? (meeting.startUrl ?? meeting.joinUrl) : meeting.joinUrl,
    isHost: isTutorOnThisBooking,
    startsAt: meeting.startsAt.toISOString(),
    durationMinutes: meeting.durationMinutes,
    passcode: isTutorOnThisBooking ? (meeting.password ?? null) : null,
  };
}

/** Which of these bookings have a meeting, so a list can show the right button. */
export async function bookingsWithMeetings(bookingIds: string[]): Promise<Set<string>> {
  await connectDB();

  if (bookingIds.length === 0) return new Set();

  const meetings = await ZoomMeeting.find({ booking: { $in: bookingIds } })
    .select('booking')
    .lean();

  return new Set(
    meetings
      .map((meeting) => meeting.booking?.toString())
      .filter((id): id is string => Boolean(id))
  );
}
