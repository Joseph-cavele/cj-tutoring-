'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { recordLessonAction } from '@/actions/lesson.actions';
import { ATTENDANCE_STATUS, type AttendanceStatus } from '@/models/types';
import {
  LESSON_PROGRESS,
  LESSON_PROGRESS_LABELS,
  type LessonProgress,
} from '@/lib/lessons/constants';

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

export type LessonWriteUpFormProps = {
  bookingId: string;
  studentName: string;
  subjectName: string;
  /** Already formatted server-side, so the markup carries no timezone logic. */
  when: string;
};

/**
 * The post-lesson write-up.
 *
 * Built for a phone held one-handed between lessons: attendance and progress
 * are tap targets rather than selects, so the common case is three taps and no
 * typing. Notes and homework stay optional because a tutor who only has time
 * to mark attendance must still be able to save.
 */
export default function LessonWriteUpForm({
  bookingId,
  studentName,
  subjectName,
  when,
}: LessonWriteUpFormProps) {
  const [attendance, setAttendance] = useState<AttendanceStatus>('present');
  const [progress, setProgress] = useState<LessonProgress | undefined>();
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = (completed: boolean) => {
    setError(null);
    setSavedDraft(false);

    startTransition(async () => {
      const result = await recordLessonAction({
        bookingId,
        attendance,
        progress,
        // Empty strings would fail the optional-string check; send nothing.
        notes: notes.trim() || undefined,
        homework: homework.trim() || undefined,
        completed,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // On completion the row leaves the queue and the page revalidates, so
      // only the draft case needs its own acknowledgement.
      if (!completed) setSavedDraft(true);
    });
  };

  return (
    <form
      className="rounded-2xl border border-brand-blue-100 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit(true);
      }}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-brand-navy">{studentName}</h3>
        <p className="text-sm text-brand-slate">
          {subjectName} &middot; {when}
        </p>
      </header>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-brand-navy">Attendance</legend>
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_STATUS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setAttendance(status)}
              aria-pressed={attendance === status}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue',
                attendance === status
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-brand-blue-100 text-brand-navy hover:bg-brand-blue-50'
              )}
            >
              {ATTENDANCE_LABELS[status]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold text-brand-navy">
          Progress <span className="font-normal text-brand-slate">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {LESSON_PROGRESS.map((value) => (
            <button
              key={value}
              type="button"
              // Tapping the selected one clears it, so an accidental tap is
              // undoable without a separate "none" control.
              onClick={() => setProgress((current) => (current === value ? undefined : value))}
              aria-pressed={progress === value}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue',
                progress === value
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-brand-blue-100 text-brand-navy hover:bg-brand-blue-50'
              )}
            >
              {LESSON_PROGRESS_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-navy">
          Lesson notes <span className="font-normal text-brand-slate">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Covered quadratic equations."
          className="w-full rounded-xl border border-brand-blue-100 bg-white p-3 text-base text-brand-navy placeholder:text-brand-slate/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-blue"
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-navy">
          Homework <span className="font-normal text-brand-slate">(optional)</span>
        </span>
        <textarea
          value={homework}
          onChange={(event) => setHomework(event.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="Complete questions 1-10."
          className="w-full rounded-xl border border-brand-blue-100 bg-white p-3 text-base text-brand-navy placeholder:text-brand-slate/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-blue"
        />
      </label>

      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {savedDraft && (
        <p role="status" className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-blue">
          <Check className="size-4" aria-hidden="true" />
          Draft saved. It stays in your queue until you mark it done.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand-blue px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save and mark done
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(false)}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border-[1.5px] border-brand-blue px-6 text-[15px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60"
        >
          Save draft
        </button>
      </div>
    </form>
  );
}
