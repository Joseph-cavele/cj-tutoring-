import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import ImagePlaceholder from './ImagePlaceholder';
import SubjectTabs from './SubjectTabs';

/**
 * Design.md section 7 item 6: subjects, clearly organised, with a tabbed card
 * and a soft CTA for parents who are not sure what their child needs.
 *
 * Server component - only the tab strip below is interactive.
 */
export default function SubjectsSection() {
  return (
    <section className="bg-brand-cream py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Maths &amp; Science,{' '}
            <span className="text-brand-blue">grade by grade</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate sm:text-[17px]">
            From Grade 8 foundations through to Grade 12 exam preparation. Pick a
            grade to see exactly what we teach.
          </p>
        </div>

        <div className="mt-10 lg:mt-14">
          <SubjectTabs />
        </div>

        {/* Soft CTA band for undecided parents. */}
        <div className="mt-10 grid items-center gap-6 rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8 lg:mt-14 lg:grid-cols-2 lg:gap-10">
          <div>
            <h3 className="text-xl font-bold text-brand-navy sm:text-2xl">
              Not sure which subject your child needs?
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-brand-slate">
              Book a lesson and we will assess where they are, then recommend a
              subject, grade level and lesson format.
            </p>
            <Link
              href="/booking"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-blue px-7 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              Book a Lesson
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>

          {/* 16/9 matches the source at 1.83:1, so the crop takes 3% off the
              sides rather than the 27% a 4/3 frame would cut into both faces. */}
          <ImagePlaceholder
            src="/one-to-one.png"
            alt="A tutor explaining a maths problem to a student working through it in her exercise book"
            aspect="aspect-[16/9]"
            label="Tutor with a single student"
            sizes="(min-width: 1024px) 32rem, 92vw"
          />
        </div>
      </div>
    </section>
  );
}
