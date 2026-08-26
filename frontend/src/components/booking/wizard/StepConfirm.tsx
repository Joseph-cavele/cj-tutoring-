'use client';

import { addMinutes } from '@/lib/availability/slots';
import {
  MODE_LABELS,
  formatBookingDate,
  formatDuration,
  type BookableStudent,
  type BookableSubject,
  type BookableTutor,
  type BookingDraft,
} from '@/types/booking';

/**
 * Step 5: review before committing.
 *
 * The price shown is calculated from the tutor's advertised rate purely so the
 * payer knows what to expect. It is not sent anywhere: the server recomputes
 * the amount from the tutor record, so editing this number in the browser
 * changes nothing (brief section 13).
 */
export default function StepConfirm({
  draft,
  student,
  subject,
  tutor,
}: {
  draft: BookingDraft;
  student: BookableStudent | null;
  subject: BookableSubject | null;
  tutor: BookableTutor | null;
}) {
  const estimate = tutor?.hourlyRate
    ? Math.round((tutor.hourlyRate * draft.durationMinutes) / 60)
    : null;

  const rows: { label: string; value: string }[] = [
    { label: 'Student', value: student?.name ?? '—' },
    { label: 'Subject', value: subject?.name ?? '—' },
    { label: 'Tutor', value: tutor?.name ?? '—' },
    { label: 'Date', value: formatBookingDate(draft.date) },
    {
      label: 'Time',
      value: `${draft.startTime} – ${addMinutes(draft.startTime, draft.durationMinutes)}`,
    },
    { label: 'Length', value: formatDuration(draft.durationMinutes) },
    { label: 'Format', value: MODE_LABELS[draft.teachingMode] },
  ];

  return (
    <div className="space-y-5">
      <dl className="divide-y divide-brand-blue-100 rounded-2xl border border-brand-blue-100 bg-white">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-[14px] text-brand-slate">{row.label}</dt>
            <dd className="text-right text-[15px] font-semibold text-brand-navy">
              {row.value}
            </dd>
          </div>
        ))}

        {estimate !== null ? (
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-[14px] text-brand-slate">Total</dt>
            <dd className="text-right text-[17px] font-extrabold text-brand-navy">
              R{estimate}
            </dd>
          </div>
        ) : null}
      </dl>

      {draft.notes ? (
        <div className="rounded-2xl bg-brand-blue-50/60 p-4">
          <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
            Your note
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-line text-brand-navy">
            {draft.notes}
          </p>
        </div>
      ) : null}

      <p className="text-[13px] leading-relaxed text-brand-slate">
        Your request goes to the tutor for approval. Times are South African
        Standard Time.
      </p>
    </div>
  );
}
