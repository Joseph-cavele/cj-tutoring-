'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

import { adminUpdateTutorAction, setTutorApprovalAction } from '@/actions/tutor.actions';
import type { DeliveryMode } from '@/models/types';
import { MODE_LABELS } from '@/types/booking';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * Approve, suspend, and fill in a tutor's commercial details
 * (brief section 12).
 *
 * These controls only ask; both actions re-check the admin role on the server
 * before writing, so rendering them is not what grants the power.
 */

const MODE_CHOICES: DeliveryMode[] = ['online', 'in_person', 'hybrid'];

export default function TutorApproval({
  tutorId,
  isVerified,
  isActive,
  hourlyRate,
  subjectIds,
  teachingModes,
  subjects,
}: {
  tutorId: string;
  isVerified: boolean;
  isActive: boolean;
  hourlyRate: number | null;
  subjectIds: string[];
  teachingModes: DeliveryMode[];
  subjects: { subjectId: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState<number>(hourlyRate ?? 250);
  const [chosenSubjects, setChosenSubjects] = useState<string[]>(subjectIds);
  const [chosenModes, setChosenModes] = useState<DeliveryMode[]>(
    teachingModes.length ? teachingModes : ['online']
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const approve = (nextVerified: boolean, nextActive: boolean) => {
    setError(null);

    startTransition(async () => {
      const result = await setTutorApprovalAction({
        tutorId,
        isVerified: nextVerified,
        isActive: nextActive,
      });

      if (!result.ok) setError(result.error);
    });
  };

  const saveDetails = () => {
    setError(null);

    startTransition(async () => {
      const result = await adminUpdateTutorAction({
        tutorId,
        hourlyRate: rate,
        subjectIds: chosenSubjects,
        teachingModes: chosenModes,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEditing(false);
    });
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!isVerified ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => approve(true, true)}
            className={PRIMARY_BUTTON}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Approve tutor
          </button>
        ) : isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => approve(true, false)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-red-200 px-6 text-[15px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            <X className="size-4" aria-hidden="true" />
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => approve(true, true)}
            className={SECONDARY_BUTTON}
          >
            <Check className="size-4" aria-hidden="true" />
            Reactivate
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className={SECONDARY_BUTTON}
        >
          <Pencil className="size-4" aria-hidden="true" />
          {editing ? 'Close' : 'Rate and subjects'}
        </button>
      </div>

      {editing ? (
        <div className="rounded-xl bg-brand-blue-50/60 p-4">
          <label className="block max-w-40">
            <span className="block text-[13px] font-semibold text-brand-navy">
              Rand per hour
            </span>
            <input
              type="number"
              min={0}
              max={10000}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              className={`${FIELD_CLASS} mt-1`}
            />
          </label>

          <fieldset className="mt-3">
            <legend className="text-[13px] font-semibold text-brand-navy">Subjects</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const selected = chosenSubjects.includes(subject.subjectId);

                return (
                  <button
                    key={subject.subjectId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setChosenSubjects((current) => toggle(current, subject.subjectId))
                    }
                    className={`min-h-11 rounded-full border-[1.5px] px-3 text-[13px] font-semibold transition-colors ${
                      selected
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-white'
                    }`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="text-[13px] font-semibold text-brand-navy">Format</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {MODE_CHOICES.map((mode) => {
                const selected = chosenModes.includes(mode);

                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChosenModes((current) => toggle(current, mode))}
                    className={`min-h-11 rounded-full border-[1.5px] px-3 text-[13px] font-semibold transition-colors ${
                      selected
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-white'
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={saveDetails}
            disabled={pending}
            className={`${PRIMARY_BUTTON} mt-4`}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving&hellip;
              </>
            ) : (
              'Save details'
            )}
          </button>
        </div>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}
