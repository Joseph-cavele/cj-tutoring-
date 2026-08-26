import { AlertCircle, Check, Loader2 } from 'lucide-react';

/**
 * Small presentational pieces shared by the wizard and the dashboards.
 *
 * These carry no booking logic - they decide only how something looks - so
 * they stay usable from both server and client components.
 */

/** Mobile-first: 48px minimum touch target throughout (CLAUDE.md section 29). */
export const FIELD_CLASS =
  'min-h-12 w-full rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-4 text-[15px] text-brand-navy placeholder:text-brand-slate/60 focus:border-brand-blue focus:bg-white focus:outline-2 focus:outline-offset-1 focus:outline-brand-blue';

export const PRIMARY_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-blue px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue';

export const SECONDARY_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-blue px-6 text-[15px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[14px] font-semibold text-brand-navy"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error ? (
        <p className="mt-1.5 text-[13px] text-brand-slate">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A large, tappable choice.
 *
 * Radio-style selection rendered as a card rather than a native radio, because
 * students are mostly on phones and a card is far easier to hit than a 16px
 * circle. Still a real button, so keyboard and screen-reader users get the
 * pressed state via aria-pressed.
 */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  subtitle,
  meta,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  meta?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-2xl border-[1.5px] p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-brand-blue bg-brand-blue-50'
          : 'border-brand-blue-100 bg-white hover:border-brand-blue hover:bg-brand-blue-50/50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          selected ? 'border-brand-blue bg-brand-blue text-white' : 'border-brand-blue-100'
        }`}
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-brand-navy">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-brand-slate">
            {subtitle}
          </span>
        ) : null}
      </span>

      {meta ? (
        <span className="shrink-0 text-[13px] font-semibold text-brand-blue">{meta}</span>
      ) : null}
    </button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[14px] text-red-700"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function LoadingRow({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-[14px] text-brand-slate">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

/** Empty state. Explains what to do next rather than showing a blank panel. */
export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-6 text-center">
      <p className="text-[15px] font-semibold text-brand-navy">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-brand-slate">
        {body}
      </p>
    </div>
  );
}
