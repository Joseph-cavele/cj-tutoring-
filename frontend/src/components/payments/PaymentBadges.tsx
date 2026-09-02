import type { PaymentStatus } from '@/models/types';
import {
  METHOD_LABELS,
  PLAN_LABELS,
  type PaymentMethod,
  type PaymentPlan,
} from '@/lib/payments/plans';

/**
 * The small coloured labels used wherever a payment is listed.
 *
 * Shared between the student's history and the owner's table so one status
 * cannot read as green on one screen and grey on the other - which, for money,
 * is the difference between "we have it" and "we are chasing it".
 *
 * Presentational only, so both server and client components can render them.
 */

const STATUS_CLASS: Record<PaymentStatus, string> = {
  successful: 'bg-green-100 text-green-900',
  pending: 'bg-amber-100 text-amber-900',
  failed: 'bg-red-100 text-red-900',
  // Deliberately quieter than `failed`: nobody needs to chase these.
  cancelled: 'bg-brand-blue-50 text-brand-slate',
  refunded: 'bg-brand-blue-100 text-brand-navy',
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  successful: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const BADGE =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap';

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`${BADGE} ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
  );
}

export function PlanBadge({ plan }: { plan: PaymentPlan }) {
  return (
    <span
      className={`${BADGE} ${
        plan === 'monthly'
          ? 'bg-brand-blue-100 text-brand-navy'
          : 'bg-brand-cream text-brand-slate'
      }`}
    >
      {PLAN_LABELS[plan]}
    </span>
  );
}

export function MethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className={`${BADGE} bg-brand-blue-50 text-brand-slate`}>
      {METHOD_LABELS[method]}
    </span>
  );
}

/**
 * "3 of 4 lessons remaining", drawn as a bar.
 *
 * The bar is `aria-hidden` and the sentence carries the meaning, so a screen
 * reader gets the count rather than a decorative rectangle.
 */
export function LessonMeter({
  total,
  used,
  className = '',
}: {
  total: number;
  used: number;
  className?: string;
}) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className={className}>
      <p className="text-[14px] font-semibold text-brand-navy">
        {remaining === 0
          ? 'Monthly plan completed'
          : `${remaining} of ${total} lesson${total === 1 ? '' : 's'} remaining`}
      </p>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-blue-100"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            remaining === 0 ? 'bg-brand-slate' : 'bg-brand-blue'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
