import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * One tile in a dashboard's quick-access grid.
 *
 * Built for a phone first (CLAUDE.md section 29): the whole tile is the tap
 * target, well past the 48px minimum, so nobody has to hit a small link.
 *
 * Design.md allows two hues and no more, so the tint alternates between blue
 * and amber rather than giving every tile its own colour. The tint carries no
 * meaning - it only helps the eye separate one tile from the next - so nothing
 * is lost by a reader who cannot tell them apart.
 */

export type TileTone = 'blue' | 'amber';

const TONES: Record<TileTone, { card: string; icon: string }> = {
  blue: {
    card: 'bg-brand-blue-50 hover:bg-brand-blue-100/70',
    icon: 'bg-brand-blue text-white',
  },
  amber: {
    card: 'bg-brand-amber/12 hover:bg-brand-amber/20',
    icon: 'bg-brand-amber text-white',
  },
};

export default function QuickAccessTile({
  href,
  icon,
  title,
  body,
  tone = 'blue',
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  /** One short line under the title. */
  body: string;
  tone?: TileTone;
  /** A count worth pulling forward, e.g. lessons still to pay for. */
  badge?: number;
}) {
  const style = TONES[tone];

  return (
    <Link
      href={href}
      className={`group relative flex min-h-[124px] flex-col justify-between rounded-2xl p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${style.card}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={`flex size-10 items-center justify-center rounded-xl ${style.icon}`}
        >
          {icon}
        </span>

        {badge && badge > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand-amber px-2 py-0.5 text-[12px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </span>

      <span className="mt-3 block">
        <span className="flex items-center gap-1 text-[15px] font-bold text-brand-navy">
          {title}
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-brand-slate transition-transform group-hover:translate-x-0.5"
          />
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-brand-slate">
          {body}
        </span>
      </span>
    </Link>
  );
}
