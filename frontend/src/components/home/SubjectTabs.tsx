'use client';

import { BookOpen, FlaskConical } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GRADES, subjectsForGrade, type Grade } from '@/lib/curriculum';

const ICONS = {
  mathematics: BookOpen,
  'physical-science': FlaskConical,
} as const;

/**
 * Grade-by-grade subject card.
 *
 * Client component because the tabs are interactive; the data itself comes
 * from lib/curriculum so this file holds no rules of its own.
 *
 * Grades 8 and 9 list Mathematics only. That is not an omission - CLAUDE.md
 * section 4 says unsupported grade/subject combinations must never be offered,
 * and Physical Science starts at Grade 10.
 */
export default function SubjectTabs() {
  return (
    <Tabs defaultValue="10" className="w-full">
      <TabsList
        variant="line"
        className="mx-auto flex w-full max-w-md justify-between gap-1 rounded-full bg-white p-1.5 shadow-[var(--shadow-soft)]"
      >
        {GRADES.map((grade) => (
          <TabsTrigger
            key={grade}
            value={String(grade)}
            // 44px minimum tap target (Design.md section 9).
            className="min-h-11 flex-1 rounded-full px-3 text-[14px] font-semibold text-brand-slate data-active:bg-brand-blue data-active:text-white"
          >
            Grade {grade}
          </TabsTrigger>
        ))}
      </TabsList>

      {GRADES.map((grade) => (
        <TabsContent key={grade} value={String(grade)} className="mt-8">
          <SubjectPanel grade={grade} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function SubjectPanel({ grade }: { grade: Grade }) {
  const subjects = subjectsForGrade(grade);

  return (
    <div className="rounded-3xl border border-brand-blue-100 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8">
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        {subjects.map((subject) => {
          const Icon = ICONS[subject.slug];

          return (
            <li
              key={subject.slug}
              className="flex gap-4 rounded-2xl bg-brand-blue-50/60 p-4 sm:p-5"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
              >
                <Icon className="size-5" strokeWidth={2.5} />
              </span>
              <div>
                <h3 className="text-[16px] font-bold text-brand-navy">{subject.name}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">
                  {subject.blurb}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Explains the gap rather than leaving a parent wondering. */}
      {subjects.length === 1 && (
        <p className="mt-5 text-[13px] leading-relaxed text-brand-slate">
          Physical Science starts in Grade 10. In Grade {grade} we focus on building
          the Mathematics foundation the FET phase depends on.
        </p>
      )}
    </div>
  );
}
