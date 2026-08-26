import Link from 'next/link';
import { ArrowRight, ClipboardCheck, Repeat, Sparkles, UsersRound } from 'lucide-react';

import ImagePlaceholder from './ImagePlaceholder';

/**
 * Design.md section 7 item 7: the brand-story slot the mockup uses for
 * "Why the octopus?".
 *
 * The four reasons are the actual product differentiators from CLAUDE.md
 * section 31: Zoom handles the live teaching, and the platform handles
 * everything around it - attendance (14), performance (13), the parent view (3)
 * and the study assistant (17). Nothing here is a claim the system cannot back.
 */
const REASONS = [
  {
    icon: ClipboardCheck,
    title: 'Every lesson is tracked',
    body: 'Attendance, marks and weak topics recorded per subject, lesson by lesson, not remembered at the end of term.',
  },
  {
    icon: UsersRound,
    title: 'Parents can see progress',
    body: 'A parent login showing attendance, results and performance, so nobody has to chase anyone for an update.',
  },
  {
    icon: Sparkles,
    title: 'Support between lessons',
    body: 'A study assistant and materials for the days between sessions. It supports the tutor, it does not replace them.',
  },
  {
    icon: Repeat,
    title: 'One plan, any format',
    body: 'Move between online, in-person, group classes and exam preparation without starting the plan again.',
  },
] as const;

export default function WhyChooseUs() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Copy column */}
          <div>
            {/* Script accent, one short phrase only (Design.md section 2). */}
            <p className="font-script text-3xl text-brand-amber sm:text-4xl">
              More than a video call
            </p>

            <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
              Why choose CJ Private Tutoring?
            </h2>

            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-brand-slate sm:text-[17px]">
              Plenty of tutors can run a lesson. The difference shows in what
              happens around the lesson - what gets recorded, what parents can
              see, and what a student does between sessions.
            </p>

            <ul className="mt-8 space-y-5">
              {REASONS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue"
                  >
                    <Icon className="size-5" strokeWidth={2.25} />
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-brand-navy">{title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/about"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-blue px-7 text-[15px] font-semibold whitespace-nowrap text-brand-blue transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              Read Our Story
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>

          {/* 2/3 matches the source exactly (687x1024), so nothing is cropped. */}
          <ImagePlaceholder
            src="/why-choose.png"
            alt="A tutor standing beside a seated student, pointing at a row of marks on his progress sheet"
            aspect="aspect-[2/3]"
            label="Tutor reviewing progress with a student"
            sizes="(min-width: 1024px) 32rem, 92vw"
            className="lg:order-last"
          />
        </div>
      </div>
    </section>
  );
}
