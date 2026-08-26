'use client';

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';

import type { DeliveryMode } from '@/models/types';
import {
  MODE_LABELS,
  formatDuration,
  type BookableTutor,
  type BookingDraft,
  type TimeSlot,
} from '@/types/booking';
import { ChoiceCard, EmptyNote, ErrorNote, Field, FIELD_CLASS, LoadingRow } from '@/components/booking/ui';

/**
 * Step 4: format, date, length and time.
 *
 * The time list is fetched from the server for the chosen tutor and date, and
 * only free slots come back. Nothing here decides what is available - the
 * server does, and it checks again on submit, so a stale list cannot produce
 * a double booking.
 */

/** Identifies which query a cached result belongs to. */
function slotKeyFor(draft: BookingDraft): string {
  return `${draft.tutorId}|${draft.date}|${draft.teachingMode}`;
}

type SlotCache = {
  key: string;
  slots: TimeSlot[];
  slotMinutes: number[];
};

export default function StepSchedule({
  draft,
  tutor,
  /** Today in South Africa, computed on the server so it does not depend on
   *  the device clock or a render-time Date.now(). */
  minDate,
  onChange,
}: {
  draft: BookingDraft;
  tutor: BookableTutor | null;
  minDate: string;
  onChange: (patch: Partial<BookingDraft>) => void;
}) {
  // Cached against the query it answers, so a result for a previous date is
  // never shown for the current one - and nothing has to be cleared in an
  // effect to make that true.
  const [cache, setCache] = useState<SlotCache>({ key: '', slots: [], slotMinutes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modes: DeliveryMode[] = tutor?.teachingModes?.length
    ? tutor.teachingModes
    : ['online'];

  const wanted = slotKeyFor(draft);
  const ready = Boolean(draft.tutorId && draft.date);
  const isCurrent = cache.key === wanted;

  const slots = ready && isCurrent ? cache.slots : [];
  const slotMinutes = ready && isCurrent ? cache.slotMinutes : [];

  useEffect(() => {
    if (!draft.tutorId || !draft.date) return;

    const controller = new AbortController();

    async function loadSlots() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        tutorId: draft.tutorId,
        date: draft.date,
        teachingMode: draft.teachingMode,
      });

      if (draft.studentId) params.set('studentId', draft.studentId);

      try {
        const response = await fetch(`/api/booking/slots?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data.error ?? 'Could not load available times');
          return;
        }

        setCache({
          key: `${draft.tutorId}|${draft.date}|${draft.teachingMode}`,
          slots: data.slots ?? [],
          slotMinutes: data.slotMinutes ?? [],
        });
      } catch (fetchError) {
        // An aborted request is the previous date being replaced, not a fault.
        if ((fetchError as Error).name === 'AbortError') return;
        setError('No connection. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadSlots();

    return () => controller.abort();
  }, [draft.tutorId, draft.date, draft.teachingMode, draft.studentId]);

  // A chosen time is only honoured while it is still in the current list. The
  // date and format handlers already clear it; this covers a slot that was
  // taken by someone else while the form was open, and the server re-checks
  // in any case.
  const chosenStillFree = slots.some((slot) => slot.startTime === draft.startTime);

  const baseSlot = slotMinutes[0] ?? 60;
  const durations = [baseSlot, baseSlot * 2, baseSlot * 3].filter((minutes) => minutes <= 240);

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-[14px] font-semibold text-brand-navy">
          How would you like the lesson?
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {modes.map((mode) => (
            <ChoiceCard
              key={mode}
              selected={draft.teachingMode === mode}
              onSelect={() => onChange({ teachingMode: mode, startTime: '' })}
              title={MODE_LABELS[mode]}
            />
          ))}
        </div>
      </fieldset>

      <Field label="Date" htmlFor="booking-date">
        <div className="relative">
          <CalendarDays
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand-slate"
            aria-hidden="true"
          />
          <input
            id="booking-date"
            type="date"
            min={minDate}
            value={draft.date}
            onChange={(event) => onChange({ date: event.target.value, startTime: '' })}
            className={`${FIELD_CLASS} pl-11`}
          />
        </div>
      </Field>

      {durations.length > 1 ? (
        <fieldset>
          <legend className="text-[14px] font-semibold text-brand-navy">
            Lesson length
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {durations.map((minutes) => (
              <ChoiceCard
                key={minutes}
                selected={draft.durationMinutes === minutes}
                onSelect={() => onChange({ durationMinutes: minutes })}
                title={formatDuration(minutes)}
                meta={
                  tutor?.hourlyRate
                    ? `R${Math.round((tutor.hourlyRate * minutes) / 60)}`
                    : undefined
                }
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <div>
        <p className="text-[14px] font-semibold text-brand-navy">Available times</p>

        {!draft.date ? (
          <p className="mt-2 text-[14px] text-brand-slate">Choose a date first.</p>
        ) : loading ? (
          <LoadingRow label="Checking this tutor&rsquo;s diary&hellip;" />
        ) : error ? (
          <div className="mt-2">
            <ErrorNote message={error} />
          </div>
        ) : slots.length === 0 ? (
          <div className="mt-2">
            <EmptyNote
              title="Nothing free on that day"
              body="This tutor has no open times then. Try another date, or go back and pick a different tutor."
            />
          </div>
        ) : (
          <>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((slot) => {
                const selected = draft.startTime === slot.startTime;

                return (
                  <li key={slot.startTime}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange({ startTime: slot.startTime })}
                      className={`min-h-12 w-full rounded-xl border-[1.5px] text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                        selected
                          ? 'border-brand-blue bg-brand-blue text-white'
                          : 'border-brand-blue-100 bg-white text-brand-navy hover:border-brand-blue hover:bg-brand-blue-50'
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  </li>
                );
              })}
            </ul>

            {draft.startTime && !chosenStillFree ? (
              <p className="mt-2 text-[13px] font-medium text-brand-amber-text">
                The time you picked is no longer free. Choose another.
              </p>
            ) : null}
          </>
        )}
      </div>

      <Field
        label="Anything the tutor should know?"
        htmlFor="booking-notes"
        hint="Optional. For example the topic you want to cover."
      >
        <textarea
          id="booking-notes"
          rows={3}
          maxLength={1000}
          value={draft.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="We are preparing for the trigonometry test next week."
          className={`${FIELD_CLASS} py-3`}
        />
      </Field>
    </div>
  );
}
