import { connectDB } from '@/lib/mongodb';
import { Attendance, Booking, Student, ZoomMeeting } from '@/models';
import type { AttendanceStatus } from '@/models/types';

/**
 * Acts on verified Zoom events.
 *
 * Nothing here re-checks the signature - the route does that before calling in,
 * and this module must never be reachable from anywhere that has not. Every
 * field written here comes from Zoom, so it is the one source allowed to say a
 * lesson actually happened; the app itself only ever writes `scheduled`.
 *
 * Unknown events are ignored rather than treated as errors. Zoom lets you
 * subscribe to a long list, and answering 200 to one we do not handle stops it
 * being retried for hours.
 */

/** The slice of a Zoom event payload this service reads. */
export type ZoomEvent = {
  event?: string;
  payload?: {
    object?: {
      id?: string | number;
      uuid?: string;
      start_time?: string;
      end_time?: string;
      participant?: {
        id?: string;
        user_id?: string;
        user_name?: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
};

export type ZoomEventOutcome =
  | { handled: true; event: string; meetingId: string }
  | { handled: false; reason: 'unknown-event' | 'no-meeting-id' | 'unknown-meeting' };

/** Zoom sends meeting ids as numbers in some events and strings in others. */
function meetingIdOf(event: ZoomEvent): string | null {
  const id = event.payload?.object?.id;

  if (id === undefined || id === null || id === '') return null;

  return String(id);
}

function asDate(value?: string): Date | undefined {
  if (!value) return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Marks the lesson finished once Zoom says the meeting ended.
 *
 * Only from `accepted`. A lesson that was cancelled or rejected must not be
 * resurrected as completed by a late event, and one already completed does not
 * need writing twice.
 */
async function completeBookingFor(bookingId: unknown) {
  if (!bookingId) return;

  await Booking.updateOne(
    { _id: bookingId, status: 'accepted' },
    { $set: { status: 'completed' } }
  );
}

/** Counted as present from this share of the booked lesson onwards. */
const PRESENT_THRESHOLD = 0.5;

/** Joining this many minutes after the meeting started counts as late. */
const LATE_AFTER_MINUTES = 10;

type MeetingParticipant = {
  name?: string;
  email?: string;
  joinedAt?: Date;
  leftAt?: Date;
  minutes?: number;
};

/**
 * Works out how the student did, from the participant list.
 *
 * Matching is by email first, because that is the only identifier a student
 * cannot casually change; the display name is a fallback for a student who
 * joined from the Zoom app without signing in. If neither matches, nobody
 * recognisable turned up, which is what `absent` means.
 *
 * Exported for its own test - the thresholds are a judgement call and worth
 * pinning down.
 */
export function assessAttendance(params: {
  participants: MeetingParticipant[];
  studentEmail?: string | null;
  studentName?: string | null;
  bookedMinutes: number;
  meetingStartedAt?: Date | null;
}): {
  status: AttendanceStatus;
  minutesAttended: number;
  joinedAt?: Date;
  leftAt?: Date;
} {
  const email = params.studentEmail?.toLowerCase().trim();
  const name = params.studentName?.toLowerCase().trim();

  const theirs = params.participants.filter((entry) => {
    if (email && entry.email) return entry.email.toLowerCase().trim() === email;
    if (name && entry.name) return entry.name.toLowerCase().trim() === name;
    return false;
  });

  if (theirs.length === 0) {
    return { status: 'absent', minutesAttended: 0 };
  }

  // Summed across stints, so dropping out and rejoining is not punished.
  const minutesAttended = theirs.reduce((total, entry) => total + (entry.minutes ?? 0), 0);

  const joins = theirs
    .map((entry) => entry.joinedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());

  const leaves = theirs
    .map((entry) => entry.leftAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime());

  const joinedAt = joins[0];
  const leftAt = leaves[0];

  // Barely there at all: recorded as absent rather than flattering the number.
  if (params.bookedMinutes > 0 && minutesAttended < params.bookedMinutes * PRESENT_THRESHOLD) {
    return { status: 'absent', minutesAttended, joinedAt, leftAt };
  }

  const lateBy =
    joinedAt && params.meetingStartedAt
      ? (joinedAt.getTime() - params.meetingStartedAt.getTime()) / 60_000
      : 0;

  return {
    status: lateBy > LATE_AFTER_MINUTES ? 'late' : 'present',
    minutesAttended,
    joinedAt,
    leftAt,
  };
}

/**
 * Writes the attendance record for a finished lesson.
 *
 * Best effort and idempotent: an upsert keyed on booking and student, so Zoom
 * re-delivering `meeting.ended` corrects the record rather than duplicating it.
 * A failure here must not fail the webhook, or Zoom retries the whole event.
 */
async function recordAttendanceFor(meeting: {
  booking?: unknown;
  durationMinutes: number;
  actualStartedAt?: Date;
  participants: MeetingParticipant[];
}) {
  if (!meeting.booking) return;

  const booking = await Booking.findById(meeting.booking)
    .select('student durationMinutes')
    .lean();

  if (!booking?.student) return;

  const student = await Student.findById(booking.student)
    .populate<{ user: { name?: string; email?: string } }>('user', 'name email')
    .select('user')
    .lean();

  const assessment = assessAttendance({
    participants: meeting.participants,
    studentEmail: student?.user?.email,
    studentName: student?.user?.name,
    bookedMinutes: booking.durationMinutes ?? meeting.durationMinutes,
    meetingStartedAt: meeting.actualStartedAt,
  });

  await Attendance.updateOne(
    { booking: booking._id, student: booking.student },
    {
      $set: {
        status: assessment.status,
        minutesAttended: assessment.minutesAttended,
        joinedAt: assessment.joinedAt,
        leftAt: assessment.leftAt,
        // No markedBy: Zoom recorded this, not a person.
        note: 'Recorded automatically from Zoom',
      },
      $setOnInsert: { booking: booking._id, student: booking.student, class: null },
    },
    { upsert: true }
  );
}

export async function handleZoomEvent(event: ZoomEvent): Promise<ZoomEventOutcome> {
  const name = event.event;

  const handled = [
    'meeting.started',
    'meeting.ended',
    'meeting.participant_joined',
    'meeting.participant_left',
  ];

  if (!name || !handled.includes(name)) {
    return { handled: false, reason: 'unknown-event' };
  }

  const meetingId = meetingIdOf(event);

  if (!meetingId) return { handled: false, reason: 'no-meeting-id' };

  await connectDB();

  const meeting = await ZoomMeeting.findOne({ meetingId });

  // A meeting this platform did not create - someone else's, or one already
  // cleaned up. Acknowledged so Zoom stops retrying, but nothing is written.
  if (!meeting) return { handled: false, reason: 'unknown-meeting' };

  const object = event.payload?.object;

  if (name === 'meeting.started') {
    meeting.status = 'started';
    meeting.actualStartedAt = asDate(object?.start_time) ?? new Date();
    await meeting.save();
  }

  if (name === 'meeting.ended') {
    meeting.status = 'ended';
    meeting.actualEndedAt = asDate(object?.end_time) ?? new Date();
    await meeting.save();

    await completeBookingFor(meeting.booking);

    // Attendance is a nice-to-have on top of a lesson that has already
    // finished, so a failure is logged rather than allowed to make Zoom retry
    // an event that was otherwise handled correctly.
    try {
      await recordAttendanceFor(meeting);
    } catch (error) {
      console.error('[zoom] could not record attendance for', meeting.meetingId, error);
    }
  }

  if (name === 'meeting.participant_joined') {
    const participant = object?.participant;

    meeting.participants.push({
      zoomUserId: participant?.user_id ?? participant?.id,
      name: participant?.user_name,
      email: participant?.email,
      joinedAt: asDate(participant?.join_time) ?? new Date(),
    });

    await meeting.save();
  }

  if (name === 'meeting.participant_left') {
    const participant = object?.participant;
    const zoomUserId = participant?.user_id ?? participant?.id;
    const leftAt = asDate(participant?.leave_time) ?? new Date();

    // The most recent still-open entry for this person. Matching on the open
    // one matters because somebody who drops and rejoins has two entries, and
    // the leave event belongs to the second.
    const open = [...meeting.participants]
      .reverse()
      .find(
        (entry) =>
          !entry.leftAt &&
          (zoomUserId ? entry.zoomUserId === zoomUserId : entry.name === participant?.user_name)
      );

    if (open) {
      open.leftAt = leftAt;

      if (open.joinedAt) {
        open.minutes = Math.max(
          0,
          Math.round((leftAt.getTime() - open.joinedAt.getTime()) / 60_000)
        );
      }

      await meeting.save();
    }
  }

  return { handled: true, event: name, meetingId };
}
