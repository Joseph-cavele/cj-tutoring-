import { Video } from 'lucide-react';

import type { MeetingAccess } from '@/services/zoom.service';

/**
 * The link into a lesson.
 *
 * A server component on purpose: the URL it renders is chosen by the Zoom
 * service from the viewer's role, so the host link is never sent to a browser
 * that should not have it. Nothing here decides access.
 *
 * Deliberately large - a student on a phone about to join a class should not
 * have to hunt for it (CLAUDE.md section 29).
 */
export default function JoinLessonButton({ meeting }: { meeting: MeetingAccess }) {
  return (
    <div>
      <a
        href={meeting.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-6 text-[16px] font-bold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:w-auto"
      >
        <Video className="size-5" aria-hidden="true" />
        {meeting.isHost ? 'Start Zoom lesson' : 'Join Zoom lesson'}
      </a>

      {meeting.isHost && meeting.passcode ? (
        <p className="mt-2 text-[13px] text-brand-slate">
          Passcode: <span className="font-semibold text-brand-navy">{meeting.passcode}</span>
        </p>
      ) : null}

      {!meeting.isHost ? (
        <p className="mt-2 text-[13px] text-brand-slate">
          Your tutor will let you in from the waiting room.
        </p>
      ) : null}
    </div>
  );
}
