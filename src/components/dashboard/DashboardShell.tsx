import Link from 'next/link';

/**
 * Frame shared by every role dashboard: a greeting, then a card grid.
 *
 * The cards are entry points, not data. Each one links to the section that
 * will own that feature, so the routes exist before the features do.
 */
export type DashboardCard = {
  title: string;
  body: string;
  href: string;
};

export default function DashboardShell({
  greeting,
  role,
  cards,
}: {
  greeting: string;
  role: string;
  cards: DashboardCard[];
}) {
  return (
    <section className="bg-brand-cream py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-[13px] font-bold tracking-wider text-brand-slate uppercase">
          {role}
        </p>
        <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          {greeting}
        </h1>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href + card.title}>
              <Link
                href={card.href}
                className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
              >
                <h2 className="text-[17px] font-bold text-brand-navy">{card.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">
                  {card.body}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
