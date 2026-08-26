import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import {
  getMaterialFilters,
  listMaterialsForStudent,
} from '@/services/material.service';
import MaterialCard from '@/components/materials/MaterialCard';
import DashboardSection from '@/components/dashboard/DashboardSection';

export const dynamic = 'force-dynamic';

/**
 * Study materials for the signed-in student (CLAUDE.md section 16).
 *
 * Grade comes from their own student record, never from the URL, so the
 * subject and topic filters can narrow what they see but can never widen it
 * beyond their grade.
 *
 * Organised grade -> subject -> topic, as the spec describes, with the grade
 * fixed because a student only has one.
 */
export default async function StudentMaterialsPage(props: {
  searchParams: Promise<{ subject?: string; topic?: string }>;
}) {
  const user = await requireRole('student', '/student/materials');

  // searchParams is a Promise in Next 16.
  const params = await props.searchParams;

  const [filters, materials] = await Promise.all([
    getMaterialFilters(user),
    listMaterialsForStudent(user, {
      subjectId: params.subject,
      topicId: params.topic,
    }),
  ]);

  // Only topics belonging to the chosen subject are worth offering.
  const topics = params.subject
    ? filters.topics.filter((topic) => topic.subjectId === params.subject)
    : filters.topics;

  // Grouped by topic so a long list reads as a table of contents.
  const byTopic = new Map<string, typeof materials>();

  for (const material of materials) {
    byTopic.set(material.topicName, [
      ...(byTopic.get(material.topicName) ?? []),
      material,
    ]);
  }

  const groups = [...byTopic.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Study materials
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Notes, worksheets and past papers for your grade.
          </p>
        </div>

        {filters.subjects.length > 0 ? (
          <nav aria-label="Filter by subject" className="flex flex-wrap gap-2">
            <FilterChip href="/student/materials" active={!params.subject} label="All" />
            {filters.subjects.map((subject) => (
              <FilterChip
                key={subject.subjectId}
                href={`/student/materials?subject=${subject.subjectId}`}
                active={params.subject === subject.subjectId}
                label={subject.name}
              />
            ))}
          </nav>
        ) : null}

        {params.subject && topics.length > 0 ? (
          <nav aria-label="Filter by topic" className="flex flex-wrap gap-2">
            <FilterChip
              href={`/student/materials?subject=${params.subject}`}
              active={!params.topic}
              label="All topics"
            />
            {topics.map((topic) => (
              <FilterChip
                key={topic.id}
                href={`/student/materials?subject=${params.subject}&topic=${topic.id}`}
                active={params.topic === topic.id}
                label={topic.name}
              />
            ))}
          </nav>
        ) : null}

        <DashboardSection
          title="Materials"
          count={materials.length}
          emptyTitle="Nothing here yet"
          emptyBody={
            params.subject || params.topic
              ? 'No materials match that filter. Try another subject or topic.'
              : 'When your tutors publish notes or past papers for your grade, they appear here.'
          }
        >
          <div className="space-y-6">
            {groups.map(([topicName, items]) => (
              <section key={topicName}>
                <h3 className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
                  {topicName}
                </h3>
                <ul className="mt-2 space-y-3">
                  {items.map((material) => (
                    <li key={material.materialId}>
                      <MaterialCard material={material} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DashboardSection>
      </div>
    </section>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
        active
          ? 'bg-brand-blue text-white'
          : 'border border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
      }`}
    >
      {label}
    </Link>
  );
}
