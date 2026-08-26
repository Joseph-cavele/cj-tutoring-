import { getMeetingForViewer } from '@/services/zoom.service';
import JoinLessonButton from '@/components/booking/JoinLessonButton';
import type { SessionUser } from '@/lib/auth/guard';

/**
 * Renders the Zoom link for a lesson, if this viewer is entitled to one.
 *
 * Async server component, so the entitlement check happens on the server for
 * every card: the meeting service re-verifies that the viewer is on the
 * booking and hands back the host link only to the assigned tutor. Renders
 * nothing at all when there is no meeting or no entitlement, which is also
 * what a viewer who is not party to the lesson gets.
 */
export default async function LessonMeetingLink({
  user,
  bookingId,
}: {
  user: SessionUser;
  bookingId: string;
}) {
  const meeting = await getMeetingForViewer(user, bookingId);

  if (!meeting) return null;

  return <JoinLessonButton meeting={meeting} />;
}
