import Link from 'next/link';

import type { StudentPerformance } from '@/services/performance.service';
import { StatTile } from '@/components/dashboard/DashboardSection';
import {
  ScoreTrendChart,
  SubjectChart,
  TopicChart,
} from '@/components/dashboard/PerformanceCharts';

/**
 * Performance for one student (brief section 10).
 *
 * Shared by the student's own page, the parent's view of a child and the
 * tutor's view of a student, because all three want the same picture. Who is
 * allowed to see which student is settled by the service that built the data,
 * not here.
 *
 * Charts and lists both, deliberately. The charts show the shape - is this
 * going up, which topic is dragging - and the lists underneath carry every
 * number as text, so the values are reachable without reading a picture.
 */
export default function PerformancePanel({
  performance,
  /** Result links only make sense for the student who sat them. */
  linkResults = false,
}: {
  performance: StudentPerformance;
  linkResults?: boolean;
}) {
  if (performance.testsCompleted === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-6 text-center">
        <p className="text-[15px] font-semibold text-brand-navy">No results yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-brand-slate">
          Performance appears here once a test has been completed and marked.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Average"
          value={`${performance.averagePercentage ?? 0}%`}
          detail="across all tests"
        />
        <StatTile
          label="Tests"
          value={performance.testsCompleted}
          detail="completed"
        />
        <StatTile
          label="Best"
          value={`${performance.highestPercentage ?? 0}%`}
          detail="highest score"
        />
        <StatTile
          label="Lowest"
          value={`${performance.lowestPercentage ?? 0}%`}
          detail="lowest score"
          highlight={(performance.lowestPercentage ?? 100) < 40}
        />
      </div>

      {performance.weakAreas.length > 0 ? (
        <section className="rounded-2xl bg-brand-amber/10 p-5">
          <h3 className="text-[16px] font-bold text-brand-amber-text">
            Areas needing improvement
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {performance.weakAreas.map((area) => (
              <li
                key={area}
                className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-navy"
              >
                {area}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The shape of the picture. The lists below carry the same numbers as
          text, so a chart is never the only way to reach a value. */}
      <ScoreTrendChart recent={performance.recent} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SubjectChart bySubject={performance.bySubject} />
        <TopicChart byTopic={performance.byTopic} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownList
          title="By subject"
          empty="No subject data yet."
          rows={performance.bySubject.map((row) => ({
            label: row.subjectName,
            percentage: row.averagePercentage,
            count: row.testCount,
          }))}
        />

        <BreakdownList
          title="By topic"
          empty="Topics appear once tests are tagged with one."
          rows={performance.byTopic.map((row) => ({
            label: row.topic,
            percentage: row.averagePercentage,
            count: row.testCount,
          }))}
        />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-[16px] font-bold text-brand-navy">Recent results</h3>

        <ul className="mt-3 divide-y divide-brand-blue-100">
          {performance.recent.map((result) => {
            const row = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-brand-navy">
                    {result.testTitle}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-brand-slate">
                    {result.subjectName}
                    {result.topic ? ` · ${result.topic}` : ''} ·{' '}
                    {new Intl.DateTimeFormat('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(result.completedAt))}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-[16px] font-extrabold text-brand-navy">
                    {result.percentage}%
                  </span>
                  <span className="block text-[13px] text-brand-slate">
                    {result.score}/{result.maxScore} · {result.grade}
                  </span>
                </span>
              </>
            );

            return (
              <li key={result.resultId}>
                {linkResults && result.attemptId ? (
                  <Link
                    href={`/student/results/${result.attemptId}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-brand-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** A labelled percentage bar list, used for both subject and topic breakdowns. */
function BreakdownList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { label: string; percentage: number; count: number }[];
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-[16px] font-bold text-brand-navy">{title}</h3>

      {rows.length === 0 ? (
        <p className="mt-3 text-[14px] text-brand-slate">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[14px] font-semibold text-brand-navy">
                  {row.label}
                </p>
                <p className="shrink-0 text-[14px] font-bold text-brand-navy">
                  {row.percentage}%
                </p>
              </div>

              {/* Colour reinforces the number rather than carrying it alone,
                  so the meaning survives for a colour-blind reader. */}
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-blue-50"
                role="img"
                aria-label={`${row.label}: ${row.percentage} percent across ${row.count} test${
                  row.count === 1 ? '' : 's'
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    row.percentage >= 70
                      ? 'bg-green-500'
                      : row.percentage >= 50
                        ? 'bg-brand-blue'
                        : 'bg-brand-amber'
                  }`}
                  style={{ width: `${Math.max(2, row.percentage)}%` }}
                />
              </div>

              <p className="mt-1 text-[12px] text-brand-slate">
                {row.count} test{row.count === 1 ? '' : 's'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
