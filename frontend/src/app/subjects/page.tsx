import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Check, FlaskConical } from 'lucide-react';

import ImagePlaceholder from '@/components/home/ImagePlaceholder';
import SubjectTabs from '@/components/home/SubjectTabs';
import { SUBJECTS, gradeRange } from '@/lib/curriculum';

export const metadata: Metadata = {
  title: 'Subjects | CJ Private Tutoring',
  description:
    'Mathematics for Grades 8 to 12 and Physical Science for Grades 10 to 12, following the CAPS curriculum.',
};

const ICONS = {
  mathematics: BookOpen,
  'physical-science': FlaskConical,
} as const;

const PHOTOS = {
  mathematics: {
    src: '/subject-mathematics.png',
    alt: 'A tutor and student working through a graph sketched in an exercise book, with a calculator and protractor on the table',
  },
  'physical-science': {
    src: '/subject-physical-science.png',
    alt: 'A student and tutor building a simple circuit with a battery and bulb beside a hand-drawn circuit diagram',
  },
} as const;

/**
 * Our Subjects.
 *
 * Content comes from lib/curriculum, the same source registration and the
 * homepage use, so a curriculum change never has to be made twice.
 */
export default function SubjectsPage() {
  const subjects = Object.values(SUBJECTS);

  return (
    <>
      {/* Page header */}
      <section className="bg-brand-cream py-14 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="font-script text-3xl text-brand-amber sm:text-4xl">Our subjects</p>
          <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl lg:text-5xl">
            Two subjects, taught properly
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate sm:text-[17px]">
            We do not teach everything. We teach Mathematics and Physical Science,
            to the CAPS curriculum, so every lesson matches what your child is
            examined on.
          </p>
        </div>
      </section>

      {/* One block per subject */}
      {subjects.map((subject, index) => {
        const Icon = ICONS[subject.slug];
        const isReversed = index % 2 === 1;

        return (
          <section
            key={subject.slug}
            id={subject.slug}
            // scroll-mt clears the sticky header when linked from the footer.
            className={`scroll-mt-24 py-14 lg:py-20 ${
              isReversed ? 'bg-brand-cream' : 'bg-white'
            }`}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={isReversed ? 'lg:order-last' : undefined}>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-12 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
                    >
                      <Icon className="size-6" strokeWidth={2.5} />
                    </span>
                    <div>
                      <h2 className="text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
                        {subject.name}
                      </h2>
                      <p className="text-[14px] font-semibold text-brand-blue">
                        {gradeRange(subject.grades)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-brand-slate">
                    {subject.blurb}
                  </p>

                  <h3 className="mt-8 text-[13px] font-bold tracking-wider text-brand-slate uppercase">
                    What we cover
                  </h3>
                  <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {subject.topics.map((topic) => (
                      <li key={topic} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-brand-blue"
                          aria-hidden="true"
                        />
                        <span className="text-[14px] leading-snug text-brand-navy">
                          {topic}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/booking"
                    className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-blue px-7 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                  >
                    Book a Lesson
                    <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                </div>

                {/* 16/9 matches the 1.83:1 sources; a 4/3 frame would crop 27%
                    off the sides and cut the work out of the photo. */}
                <ImagePlaceholder
                  src={PHOTOS[subject.slug].src}
                  alt={PHOTOS[subject.slug].alt}
                  aspect="aspect-[16/9]"
                  label={`A ${subject.name} lesson`}
                  sizes="(min-width: 1024px) 32rem, 92vw"
                />
              </div>
            </div>
          </section>
        );
      })}

      {/* Grade coverage, reusing the homepage tabs so the rules stay in one place. */}
      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
              What is available in each grade
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate">
              Physical Science begins in Grade 10. Before that we build the
              Mathematics foundation the FET phase depends on.
            </p>
          </div>

          <div className="mt-10">
            <SubjectTabs />
          </div>
        </div>
      </section>
    </>
  );
}
