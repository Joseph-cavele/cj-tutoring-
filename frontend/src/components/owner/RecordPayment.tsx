'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

import {
  recordLessonPaymentAction,
  recordPlanPaymentAction,
} from '@/actions/payment.actions';
import { formatPrice } from '@/lib/payments/format';
import { FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

type UnpaidLesson = {
  bookingId: string;
  label: string;
  amount: number;
  currency: string;
  /** Cash is refused for an online lesson, so the option is hidden. */
  isInPerson: boolean;
};

type StudentOption = { id: string; name: string };

type PlanOffer = {
  slug: string;
  name: string;
  mode: string;
  amount: number;
  currency: string;
};

/**
 * Recording money that arrived outside the gateway.
 *
 * Deliberately offers no amount field. The figure comes from the lesson or the
 * plan being settled, so a mistyped number cannot become the price of a lesson
 * (CLAUDE.md section 19) - the same rule the online path follows, applied to
 * the one place a human is the source of truth.
 *
 * Card is absent from the method list on purpose: a Paystack charge is settled
 * by the verified webhook, and a control here that could mark one paid would
 * undo the reason the webhook exists.
 */
export default function RecordPayment({
  unpaidLessons,
  students,
  offers,
}: {
  unpaidLessons: UnpaidLesson[];
  students: StudentOption[];
  offers: PlanOffer[];
}) {
  const [kind, setKind] = useState<'lesson' | 'plan'>('lesson');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [bookingId, setBookingId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [packageSlug, setPackageSlug] = useState('');
  const [method, setMethod] = useState<'cash' | 'eft'>('eft');
  const [note, setNote] = useState('');

  const selectedLesson = unpaidLessons.find((item) => item.bookingId === bookingId);
  const selectedOffer = offers.find((offer) => offer.slug === packageSlug);

  // Cash needs somebody in the room to hand it to, so it is only offered where
  // the lesson or the plan is in person. The server enforces this too.
  const cashAllowed =
    kind === 'lesson'
      ? (selectedLesson?.isInPerson ?? false)
      : selectedOffer?.mode === 'in_person';

  function submit() {
    setError(null);
    setDone(null);

    startTransition(async () => {
      const result =
        kind === 'lesson'
          ? await recordLessonPaymentAction({ bookingId, method, note: note || undefined })
          : await recordPlanPaymentAction({
              studentId,
              packageSlug,
              method,
              note: note || undefined,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDone(
        `Recorded ${formatPrice(result.data.amount)} · ${result.data.reference}`
      );
      setBookingId('');
      setStudentId('');
      setPackageSlug('');
      setNote('');
    });
  }

  const canSubmit =
    !pending &&
    (kind === 'lesson' ? Boolean(bookingId) : Boolean(studentId && packageSlug)) &&
    (method !== 'cash' || cashAllowed);

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="What is being paid for">
        {(['lesson', 'plan'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setKind(option);
              setError(null);
              setDone(null);
            }}
            aria-pressed={kind === option}
            className={`min-h-12 flex-1 rounded-xl px-4 text-[14px] font-semibold transition-colors ${
              kind === option
                ? 'bg-brand-blue text-white'
                : 'bg-brand-blue-50 text-brand-navy hover:bg-brand-blue-100'
            }`}
          >
            {option === 'lesson' ? 'A single lesson' : 'A monthly plan'}
          </button>
        ))}
      </div>

      {kind === 'lesson' ? (
        <div>
          <label
            htmlFor="record-booking"
            className="block text-[14px] font-semibold text-brand-navy"
          >
            Which lesson
          </label>
          <select
            id="record-booking"
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            className={`${FIELD_CLASS} mt-1.5`}
          >
            <option value="">Choose an unpaid lesson</option>
            {unpaidLessons.map((item) => (
              <option key={item.bookingId} value={item.bookingId}>
                {item.label} · {formatPrice(item.amount, item.currency)}
              </option>
            ))}
          </select>

          {unpaidLessons.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-brand-slate">
              Every booked lesson is already paid for or covered by a plan.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="record-student"
              className="block text-[14px] font-semibold text-brand-navy"
            >
              Which student
            </label>
            <select
              id="record-student"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className={`${FIELD_CLASS} mt-1.5`}
            >
              <option value="">Choose a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="record-plan"
              className="block text-[14px] font-semibold text-brand-navy"
            >
              Which plan
            </label>
            <select
              id="record-plan"
              value={packageSlug}
              onChange={(event) => setPackageSlug(event.target.value)}
              className={`${FIELD_CLASS} mt-1.5`}
            >
              <option value="">Choose a plan</option>
              {offers.map((offer) => (
                <option key={offer.slug} value={offer.slug}>
                  {offer.name} · {formatPrice(offer.amount, offer.currency)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <span className="block text-[14px] font-semibold text-brand-navy">
          How it was paid
        </span>

        <div className="mt-1.5 flex gap-2">
          {(['eft', 'cash'] as const).map((option) => {
            const disabled = option === 'cash' && !cashAllowed;

            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => setMethod(option)}
                aria-pressed={method === option}
                className={`min-h-12 flex-1 rounded-xl px-4 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  method === option
                    ? 'bg-brand-blue text-white'
                    : 'bg-brand-blue-50 text-brand-navy hover:bg-brand-blue-100'
                }`}
              >
                {option === 'eft' ? 'EFT' : 'Cash'}
              </button>
            );
          })}
        </div>

        {!cashAllowed ? (
          <p className="mt-1.5 text-[13px] text-brand-slate">
            Cash is only available for in-person tutoring.
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="record-note"
          className="block text-[14px] font-semibold text-brand-navy"
        >
          Note <span className="font-normal text-brand-slate">(optional)</span>
        </label>
        <input
          id="record-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="Bank reference, or who handed it over"
          className={`${FIELD_CLASS} mt-1.5`}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[14px] text-red-900"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {done ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-[14px] text-green-900"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {done}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className={`${PRIMARY_BUTTON} w-full`}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Recording
          </>
        ) : (
          'Record this payment'
        )}
      </button>
    </div>
  );
}
