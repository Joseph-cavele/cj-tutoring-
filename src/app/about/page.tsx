import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, Sparkles, UsersRound } from 'lucide-react';

import ImagePlaceholder from '@/components/home/ImagePlaceholder';

export const metadata: Metadata = {
  title: 'About Us | CJ Private Tutoring',
  description:
    'Who we are: Maths and Physical Science tutoring for Grades 8 to 12, online and in person, with progress parents can actually see.',
};

/**
 * About us.
 *
 * The three pillars are the real product differentiators from CLAUDE.md
 * section 31 - Zoom handles the teaching, the platform handles everything
 * around it - rather than generic agency copy.
 */
const PILLARS = [
  {
    icon: ClipboardCheck,
    title: 'Every lesson recorded',
    body: 'Attendance, marks and weak topics captured per subject, lesson by lesson.',
  },
  {
    icon: UsersRound,
    title: 'Parents can see it',
    body: 'A parent login showing attendance, results and performance without chasing anyone.',
  },
  {
    icon: Sparkles,
    title: 'Support between lessons',
    body: 'Study materials and a study assistant for the days between sessions.',
  },
] as const;

/**
 * Team cards.
 *
 * Deliberately unnamed: inventing tutors with names and photographs on an
 * About page would misrepresent who actually teaches your students. Replace
 * each entry with a real tutor and add their photo to /public.
 */
const TEAM_SLOTS = [
  { name: 'Tutor name', role: 'Mathematics, Grades 8 to 12', photo: '/tutor-1.png' },
  { name: 'Tutor name', role: 'Physical Science, Grades 10 to 12', photo: '/tutor-2.png' },
  { name: 'Tutor name', role: 'Mathematics, FET phase', photo: '/tutor-3.png' },
  { name: 'Tutor name', role: 'Exam preparation', photo: '/tutor-4.png' },
] as const;

export default function AboutPage() {
  return (
    <>
      {/* Hero band, title over a photo. */}
      <section className="relative isolate overflow-hidden bg-brand-blue">
        {/* Background, so next/image with fill rather than a content slot. */}
        <Image
          src="/about-hero.png"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-blue/85" />

        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 className="text-4xl leading-none font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            About us
          </h1>
        </div>
      </section>

      {/* Introduction */}
      <section className="bg-brand-cream py-14 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="font-script text-3xl text-brand-amber sm:text-4xl">Who we are</p>
              <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
                Two subjects.
                <br />
                <span className="text-brand-blue">Taught properly.</span>
              </h2>
            </div>

            <div className="space-y-4 text-[15px] leading-relaxed text-brand-slate sm:text-[16px]">
              <p>
                CJ Private Tutoring teaches Mathematics from Grade 8 to Grade 12
                and Physical Science from Grade 10 to Grade 12, following the CAPS
                curriculum. We chose two subjects rather than a long list so that
                every lesson matches what your child is actually examined on.
              </p>
              <p>
                Lessons run online or in person, one to one or in small groups,
                with focused exam preparation before finals. Whichever format a
                family picks, the lesson plan, the tracking and the reporting
                stay the same.
              </p>
            </div>
          </div>

          {/* Pillars */}
          <ul className="mt-12 grid gap-5 sm:grid-cols-3 lg:mt-16">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)]"
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
                >
                  <Icon className="size-6" strokeWidth={2.25} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold text-brand-navy">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Wide media block */}
      <section className="bg-brand-cream pb-14 lg:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ImagePlaceholder
            src="/about-lesson.png"
            alt="A tutor explaining a point to three students working around a table"
            aspect="aspect-[16/9]"
            label="A lesson in progress"
            sizes="(min-width: 1024px) 76rem, 92vw"
          />
        </div>
      </section>

      {/* Team */}
      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-script text-3xl text-brand-amber sm:text-4xl">Our people</p>
            <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
              The tutors
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate">
              Every tutor is checked before they teach, and each one owns a
              subject and a phase rather than covering everything.
            </p>
          </div>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM_SLOTS.map((member, index) => (
              <li
                key={`${member.role}-${index}`}
                className="overflow-hidden rounded-3xl bg-brand-cream shadow-[var(--shadow-soft)]"
              >
                <ImagePlaceholder
                  src={member.photo}
                  // Empty alt: the name and role sit in text directly below,
                  // so describing the portrait again just repeats it.
                  alt=""
                  aspect="aspect-[4/5]"
                  label="Tutor photo"
                  sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 92vw"
                  className="rounded-none border-0"
                />
                <div className="p-5 text-center">
                  <p className="text-[16px] font-bold text-brand-navy">{member.name}</p>
                  <p className="mt-1 text-[13px] text-brand-blue">{member.role}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12 text-center">
            <Link
              href="/booking"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-blue px-7 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              Book a Lesson
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
