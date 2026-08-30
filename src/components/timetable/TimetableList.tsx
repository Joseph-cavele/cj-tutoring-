import { CalendarClock, Clock, FileText } from 'lucide-react';

import type { TimetableDay, TimetableEntry } from '@/services/timetable.service';

/**
 * The test timetable, rendered the way the brief lays it out:
 *
 *   02 September
 *   15:00
 *   Grade 10 Mathematics
 *   Quadratic Equations
 *
 * A server component with no interactivity, so the same markup serves the
 * tutor, the student and the parent - only the data behind it differs, and
 * that scoping happens in the service.
 */
export default function TimetableList({
  days,
  emptyTitle,
  emptyBody,
  showGrade = true,
}: {
  days: TimetableDay[];
  emptyTitle: string;
  emptyBody: string;
  /** A student already knows their own grade; the tutor needs to see it. */
  showGrade?: boolean;
}) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-[var(--shadow-soft)]">
        <CalendarClock className="mx-auto size-6 text-brand-slate" aria-hidden="true" />
        <h3 className="mt-2 text-[16px] font-bold text-brand-navy">{emptyTitle}</h3>
        <p className="mx-auto mt-1 max-w-md text-[14px] leading-relaxed text-brand-slate">
          {emptyBody}
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {days.map((day) => (
        <li key={day.isoDate}>
          <article className="rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <h3 className="text-[16px] font-extrabold text-brand-navy">{day.dateLabel}</h3>

            <ul className="mt-3 space-y-3">
              {day.entries.map((entry) => (
                <li key={entry.testId}>
                  <Entry entry={entry} showGrade={showGrade} />
                </li>
              ))}
            </ul>
          </article>
        </li>
      ))}
    </ol>
  );
}

function Entry({ entry, showGrade }: { entry: TimetableEntry; showGrade: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl p-3 ${
        entry.isPast ? 'bg-brand-cream' : 'bg-brand-blue-50/60'
      }`}
    >
      <span className="font-mono text-[18px] font-bold text-brand-navy">
        {entry.timeLabel}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-brand-navy">
          {showGrade ? `${entry.gradeName} ` : ''}
          {entry.subjectName}
          {entry.isDraft ? (
            <span className="ml-2 rounded-full bg-brand-amber/20 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-amber-text uppercase">
              Draft
            </span>
          ) : null}
        </p>

        <p className="text-[14px] text-brand-slate">{entry.topic ?? entry.title}</p>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-brand-slate">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {entry.durationMinutes} min
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" aria-hidden="true" />
            {entry.totalMarks} mark{entry.totalMarks === 1 ? '' : 's'}
          </span>
          {entry.closesTimeLabel ? <span>closes {entry.closesTimeLabel}</span> : null}
        </p>
      </div>
    </div>
  );
}
