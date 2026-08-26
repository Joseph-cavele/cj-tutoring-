import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import ImagePlaceholder from './ImagePlaceholder';

/**
 * Design.md section 7 item 8: four format cards under a single
 * consistent-standard promise. Photo, title, two lines, then a Learn More link.
 *
 * The four formats come from CLAUDE.md section 1 and the pricing in section 5:
 * individual lessons online and in person, group classes, and exam preparation.
 */
const FORMATS = [
  {
    slug: 'online',
    title: 'Online Lessons',
    body: 'One-to-one over video, from anywhere. Same tutor, same plan, every week.',
    imageLabel: 'Student in an online lesson',
    src: '/format-online.png',
    alt: 'A student wearing headphones writing in his book during a video lesson with his tutor',
  },
  {
    slug: 'in-person',
    title: 'In-Person Tutoring',
    body: 'Face-to-face sessions for students who focus better away from a screen.',
    imageLabel: 'Tutor and student side by side',
    src: '/format-in-person.png',
    alt: 'A tutor and student sitting side by side, working through a diagram in an exercise book',
  },
  {
    slug: 'group-classes',
    title: 'Group Classes',
    body: 'Small groups working the same topic, at a lower cost per lesson.',
    imageLabel: 'Small group working together',
    src: '/format-group.png',
    alt: 'Four students around a table working through the same problem set while a tutor checks their progress',
  },
  {
    slug: 'exam-prep',
    title: 'Exam Preparation',
    body: 'Focused blocks before finals, built around past papers and weak topics.',
    imageLabel: 'Student revising past papers',
    src: '/format-exam-prep.png',
    alt: 'A student working through a past paper with a calculator, stacks of practice papers beside her',
  },
] as const;

export default function LearningFormats() {
  return (
    <section className="bg-brand-cream pb-16 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-script text-3xl text-brand-amber sm:text-4xl">
            Four ways to learn
          </p>
          <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            One consistent standard.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate sm:text-[17px]">
            Whichever format suits your family, the lesson plan, the tracking and
            the reporting stay the same.
          </p>
        </div>

        {/* 2x2 on tablet, four across on desktop (Design.md section 9). */}
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {FORMATS.map((format) => (
            <li
              key={format.slug}
              className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-soft)]"
            >
              {/* 16/9 matches the 1.83:1 sources: a 4/3 frame would crop 27%
                  off the sides and cut people out of their own photo. */}
              <ImagePlaceholder
                src={format.src}
                alt={format.alt}
                aspect="aspect-[16/9]"
                label={format.imageLabel}
                sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 92vw"
                className="rounded-none"
              />

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[17px] font-bold text-brand-navy">{format.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-brand-slate">
                  {format.body}
                </p>

                <Link
                  href={`/how-it-works#${format.slug}`}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                >
                  Learn More
                  {/* Four identical links need distinct accessible names
                      (Design.md section 10). */}
                  <span className="sr-only"> about {format.title}</span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
