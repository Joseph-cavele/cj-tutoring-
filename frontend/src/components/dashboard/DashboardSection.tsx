/**
 * A titled block on a dashboard, with its own empty state.
 *
 * Every list on a dashboard can legitimately be empty - a new tutor has no
 * students, a student has no lessons yet - so the empty case is part of the
 * component rather than something each page remembers to handle
 * (CLAUDE.md section 34).
 */
export default function DashboardSection({
  title,
  description,
  count,
  emptyTitle,
  emptyBody,
  action,
  children,
}: {
  title: string;
  description?: string;
  /** Number of items; 0 renders the empty state instead of `children`. */
  count: number;
  emptyTitle: string;
  emptyBody: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-brand-navy">
            {title}
            {count > 0 ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand-blue px-2 py-0.5 text-[12px] font-bold text-white">
                {count}
              </span>
            ) : null}
          </h2>
          {description ? (
            <p className="mt-1 text-[14px] text-brand-slate">{description}</p>
          ) : null}
        </div>

        {action}
      </header>

      <div className="mt-4">
        {count === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-6 text-center">
            <p className="text-[15px] font-semibold text-brand-navy">{emptyTitle}</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-brand-slate">
              {emptyBody}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** A single headline number on the overview strip. */
export function StatTile({
  label,
  value,
  detail,
  highlight,
}: {
  label: string;
  value: string | number;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        highlight ? 'bg-brand-amber/15' : 'bg-brand-blue-50/60'
      }`}
    >
      <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-extrabold tracking-tight ${
          highlight ? 'text-brand-amber-text' : 'text-brand-navy'
        }`}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[13px] text-brand-slate">{detail}</p> : null}
    </div>
  );
}
