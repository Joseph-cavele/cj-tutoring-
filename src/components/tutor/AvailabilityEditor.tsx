'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';

import { saveAvailabilityAction } from '@/actions/booking.actions';
import { WEEKDAYS } from '@/lib/booking/constants';
import type { DeliveryMode } from '@/models/types';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';
import { MODE_LABELS, formatDuration } from '@/types/booking';

/**
 * Weekly availability editor (brief section 7).
 *
 * The tutor edits the whole week and saves once; the action replaces their
 * windows in a single call. Slot length is set per window because that is what
 * decides the size of the blocks students can book - a 30-minute window and a
 * 60-minute one are genuinely different products.
 */

export type AvailabilityWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  teachingMode: DeliveryMode;
  isActive: boolean;
};

const SLOT_CHOICES = [30, 45, 60, 90, 120];
const MODE_CHOICES: DeliveryMode[] = ['online', 'in_person', 'hybrid'];

const NEW_WINDOW: AvailabilityWindow = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '16:00',
  slotMinutes: 60,
  teachingMode: 'online',
  isActive: true,
};

export default function AvailabilityEditor({
  initialWindows,
}: {
  initialWindows: AvailabilityWindow[];
}) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>(initialWindows);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const patch = (index: number, changes: Partial<AvailabilityWindow>) => {
    setSaved(false);
    setError(null);
    setWindows((current) =>
      current.map((window, position) =>
        position === index ? { ...window, ...changes } : window
      )
    );
  };

  const remove = (index: number) => {
    setSaved(false);
    setWindows((current) => current.filter((_, position) => position !== index));
  };

  const add = () => {
    setSaved(false);
    setWindows((current) => [...current, { ...NEW_WINDOW }]);
  };

  /** Catches the obvious mistake before a round trip; the server checks again. */
  const localProblem = (): string | null => {
    for (const window of windows) {
      if (window.startTime >= window.endTime) {
        const day = WEEKDAYS.find((entry) => entry.value === window.dayOfWeek)?.label;
        return `${day}: the end time must be after the start time.`;
      }

      const span =
        Number(window.endTime.slice(0, 2)) * 60 +
        Number(window.endTime.slice(3)) -
        (Number(window.startTime.slice(0, 2)) * 60 + Number(window.startTime.slice(3)));

      if (span < window.slotMinutes) {
        const day = WEEKDAYS.find((entry) => entry.value === window.dayOfWeek)?.label;
        return `${day}: the window is shorter than one ${formatDuration(
          window.slotMinutes
        )} lesson.`;
      }
    }

    return null;
  };

  const save = () => {
    const problem = localProblem();

    if (problem) {
      setError(problem);
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await saveAvailabilityAction({ windows });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
    });
  };

  return (
    <div className="space-y-4">
      {windows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-6 text-center">
          <p className="text-[15px] font-semibold text-brand-navy">
            You have no availability set
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-brand-slate">
            Students can only book times you have opened. Add a window for each
            block of the week you are free to teach.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {windows.map((window, index) => (
            <li
              key={index}
              className="rounded-2xl border border-brand-blue-100 bg-white p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="block text-[13px] font-semibold text-brand-navy">
                    Day
                  </span>
                  <select
                    value={window.dayOfWeek}
                    onChange={(event) =>
                      patch(index, { dayOfWeek: Number(event.target.value) })
                    }
                    className={`${FIELD_CLASS} mt-1`}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[13px] font-semibold text-brand-navy">
                      From
                    </span>
                    <input
                      type="time"
                      value={window.startTime}
                      onChange={(event) => patch(index, { startTime: event.target.value })}
                      className={`${FIELD_CLASS} mt-1`}
                    />
                  </label>

                  <label className="block">
                    <span className="block text-[13px] font-semibold text-brand-navy">
                      To
                    </span>
                    <input
                      type="time"
                      value={window.endTime}
                      onChange={(event) => patch(index, { endTime: event.target.value })}
                      className={`${FIELD_CLASS} mt-1`}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="block text-[13px] font-semibold text-brand-navy">
                    Lesson length
                  </span>
                  <select
                    value={window.slotMinutes}
                    onChange={(event) =>
                      patch(index, { slotMinutes: Number(event.target.value) })
                    }
                    className={`${FIELD_CLASS} mt-1`}
                  >
                    {SLOT_CHOICES.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {formatDuration(minutes)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[13px] font-semibold text-brand-navy">
                    Format
                  </span>
                  <select
                    value={window.teachingMode}
                    onChange={(event) =>
                      patch(index, { teachingMode: event.target.value as DeliveryMode })
                    }
                    className={`${FIELD_CLASS} mt-1`}
                  >
                    {MODE_CHOICES.map((mode) => (
                      <option key={mode} value={mode}>
                        {MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[14px] text-brand-navy">
                  <input
                    type="checkbox"
                    checked={window.isActive}
                    onChange={(event) => patch(index, { isActive: event.target.checked })}
                    className="size-4 rounded border-brand-blue-100 text-brand-blue focus:ring-brand-blue"
                  />
                  Open for bookings
                </label>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <ErrorNote message={error} /> : null}

      {saved ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-[14px] font-medium text-green-800"
        >
          <Check className="size-4" aria-hidden="true" />
          Availability saved. Students can book these times now.
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={add} className={SECONDARY_BUTTON}>
          <Plus className="size-4" aria-hidden="true" />
          Add a window
        </button>

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            'Save availability'
          )}
        </button>
      </div>
    </div>
  );
}
