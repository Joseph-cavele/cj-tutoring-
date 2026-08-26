'use client';

import { Check } from 'lucide-react';

import { WIZARD_STEPS, type WizardStepKey } from '@/types/booking';

/**
 * Progress across the five booking steps (brief section 16).
 *
 * On a phone the labels would wrap badly, so only the current step is named
 * there and the rest collapse to dots; from `sm` up the full trail is shown.
 */
export default function StepIndicator({ current }: { current: WizardStepKey }) {
  const currentIndex = WIZARD_STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Booking progress">
      <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase sm:hidden">
        Step {currentIndex + 1} of {WIZARD_STEPS.length} &mdash;{' '}
        <span className="text-brand-blue">{WIZARD_STEPS[currentIndex]?.label}</span>
      </p>

      <ol className="mt-3 flex items-center gap-1.5 sm:gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step.key} className="flex flex-1 items-center gap-1.5 sm:gap-2">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                  isDone
                    ? 'bg-brand-blue text-white'
                    : isCurrent
                      ? 'bg-brand-blue text-white ring-4 ring-brand-blue-100'
                      : 'bg-brand-blue-50 text-brand-slate'
                }`}
              >
                {isDone ? (
                  <>
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    <span className="sr-only">completed</span>
                  </>
                ) : (
                  index + 1
                )}
              </span>

              <span
                className={`hidden truncate text-[13px] font-semibold sm:inline ${
                  isCurrent ? 'text-brand-navy' : 'text-brand-slate'
                }`}
              >
                {step.label}
              </span>

              {index < WIZARD_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-0.5 flex-1 rounded-full ${
                    isDone ? 'bg-brand-blue' : 'bg-brand-blue-100'
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
