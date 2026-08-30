'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import {
  createSubjectAction,
  deleteSubjectAction,
  updateSubjectAction,
} from '@/actions/subject.actions';
import type { SubjectAdminView } from '@/services/subject.service';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';
import { formatDuration } from '@/types/booking';

/**
 * Add, edit and remove subjects (brief section 5).
 *
 * A subject in use cannot be deleted - the service refuses - so the UI leads
 * with "deactivate", which takes it off the booking form without breaking the
 * lessons and results that already point at it.
 */

type Draft = {
  name: string;
  description: string;
  defaultDurationMinutes: number;
  isActive: boolean;
};

const BLANK: Draft = {
  name: '',
  description: '',
  defaultDurationMinutes: 60,
  isActive: true,
};

export default function SubjectManager({ subjects }: { subjects: SubjectAdminView[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, done: () => void) => {
    setError(null);

    startTransition(async () => {
      const result = await work();

      if (!result.ok) {
        setError(result.error ?? 'Something went wrong');
        return;
      }

      done();
    });
  };

  return (
    <div className="space-y-4">
      {error ? <ErrorNote message={error} /> : null}

      {adding ? (
        <SubjectForm
          title="New subject"
          initial={BLANK}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(draft) =>
            run(
              () => createSubjectAction(draft),
              () => setAdding(false)
            )
          }
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
          <Plus className="size-4" aria-hidden="true" />
          Add a subject
        </button>
      )}

      <ul className="space-y-3">
        {subjects.map((subject) =>
          editingId === subject.subjectId ? (
            <li key={subject.subjectId}>
              <SubjectForm
                title={`Edit ${subject.name}`}
                initial={{
                  name: subject.name,
                  description: subject.description ?? '',
                  defaultDurationMinutes: subject.defaultDurationMinutes,
                  isActive: subject.isActive,
                }}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(draft) =>
                  run(
                    () => updateSubjectAction({ ...draft, subjectId: subject.subjectId }),
                    () => setEditingId(null)
                  )
                }
              />
            </li>
          ) : (
            <li
              key={subject.subjectId}
              className="rounded-2xl border border-brand-blue-100 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-[16px] font-bold text-brand-navy">
                    {subject.name}
                    {!subject.isActive ? (
                      <span className="rounded-full bg-brand-blue-50 px-2.5 py-0.5 text-[12px] font-bold tracking-wide text-brand-slate uppercase">
                        Inactive
                      </span>
                    ) : null}
                  </h3>

                  {subject.description ? (
                    <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">
                      {subject.description}
                    </p>
                  ) : null}

                  <p className="mt-1.5 text-[13px] text-brand-slate">
                    {formatDuration(subject.defaultDurationMinutes)} default ·{' '}
                    {subject.tutorCount} tutor{subject.tutorCount === 1 ? '' : 's'} ·{' '}
                    {subject.activeBookingCount} live booking
                    {subject.activeBookingCount === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(subject.subjectId)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-blue-100 px-3 text-[14px] font-semibold text-brand-navy hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => deleteSubjectAction({ subjectId: subject.subjectId }),
                        () => undefined
                      )
                    }
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function SubjectForm({
  title,
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: Draft;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
      className="rounded-2xl border-[1.5px] border-brand-blue bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-bold text-brand-navy">{title}</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded-full p-2 text-brand-slate hover:bg-brand-blue-50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-[13px] font-semibold text-brand-navy">Name</span>
          <input
            required
            maxLength={80}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Engineering Mathematics"
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Description
          </span>
          <input
            maxLength={500}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Calculus, linear algebra and differential equations."
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>

        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Default lesson length
          </span>
          <select
            value={draft.defaultDurationMinutes}
            onChange={(event) =>
              setDraft({ ...draft, defaultDurationMinutes: Number(event.target.value) })
            }
            className={`${FIELD_CLASS} mt-1`}
          >
            {[30, 45, 60, 90, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 self-end pb-3 text-[14px] text-brand-navy">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
            className="size-4 rounded border-brand-blue-100 text-brand-blue focus:ring-brand-blue"
          />
          Available for booking
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            'Save subject'
          )}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  );
}
