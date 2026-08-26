import { Award, Home, ShieldCheck } from 'lucide-react';

/**
 * Design.md section 7 item 3: a single row of credibility markers directly
 * under the hero. Facts only - each one is verifiable from CLAUDE.md.
 */
const MARKERS = [
  { icon: Award, label: 'Grades 8 - 12' },
  { icon: Home, label: 'Online & in-person' },
  { icon: ShieldCheck, label: 'CAPS aligned' },
] as const;

export default function TrustBar() {
  return (
    <section aria-label="Why families choose us" className="bg-brand-cream">
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-14">
        <ul className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-0">
          {MARKERS.map(({ icon: Icon, label }, index) => (
            <li
              key={label}
              className={
                // Thin vertical rules between items on wide screens only.
                'flex items-center gap-2.5 sm:px-6 ' +
                (index > 0 ? 'sm:border-l sm:border-brand-blue-100' : 'sm:pl-0')
              }
            >
              <Icon className="size-5 shrink-0 text-brand-amber" aria-hidden="true" />
              <span className="text-sm font-semibold text-brand-navy">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
