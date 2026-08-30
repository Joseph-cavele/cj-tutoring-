import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { listBookingsAwaitingWriteUp } from '@/services/lesson.service';
import LessonWriteUpForm from '@/components/tutor/LessonWriteUpForm';

export const dynamic = 'force-dynamic';

/** "Mon 1 Sep, 15:00" - built server-side so no timezone logic ships. */
const formatWhen = (date: Date, startTime: string) =>
  `${new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)}, ${startTime}`;

/**
 * The tutor's write-up queue: accepted lessons whose day has passed and which
 * have no finished record yet.
 *
 * Every lesson gets its own form rather than a list that opens one at a time.
 * The queue is short, the tutor works down it in one sitting, and a
 * list-then-detail flow would double the taps for no benefit.
 */
export default async function TutorLessonsPage() {
  const user = await requireRole(STAFF_ROLES, '/tutor/lessons');

  const pending = await listBookingsAwaitingWriteUp(user);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-navy">
            Lesson write-ups
          </h1>
          <p className="mt-1 text-brand-slate">
            {pending.length === 0
              ? 'Nothing waiting.'
              : `${pending.length} ${pending.length === 1 ? 'lesson' : 'lessons'} to write up.`}
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-brand-blue-100 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
            <CheckCircle2 className="mx-auto size-10 text-brand-blue" aria-hidden="true" />
            <p className="mt-3 font-semibold text-brand-navy">You are all caught up</p>
            <p className="mt-1 text-sm text-brand-slate">
              Lessons appear here once their day has passed.
            </p>
          </div>
        ) : (
          <ul className="space-y-5">
            {pending.map((booking) => {
              // Populated refs are typed as ObjectId on the lean result, so
              // they are narrowed here rather than asserted at every use.
              const student = booking.student as unknown as {
                user?: { name?: string };
                grade?: number;
              } | null;
              const subject = booking.subject as unknown as { name?: string } | null;

              return (
                <li key={String(booking._id)}>
                  <LessonWriteUpForm
                    bookingId={String(booking._id)}
                    studentName={student?.user?.name ?? 'Student'}
                    subjectName={subject?.name ?? 'Lesson'}
                    when={formatWhen(booking.date, booking.startTime)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
