import { LineChart, Target, Users } from 'lucide-react';

import ImagePlaceholder from './ImagePlaceholder';
import WaveDivider from './WaveDivider';

/**
 * Design.md section 7 item 5: the deep blue promise section. Script accent
 * line, heading, lead copy, then three feature badges.
 *
 * Claims map to CLAUDE.md: small-group and one-to-one teaching (section 3),
 * CAPS-aligned academic content (sections 4 and 12), and tracked performance
 * (sections 13 and 14).
 */
const FEATURES = [
  {
    icon: Users,
    title: 'Taught by real tutors',
    body: 'One-to-one lessons and small group classes with subject specialists, online or in person.',
  },
  {
    icon: Target,
    title: 'Structured for results',
    body: 'Every lesson maps to a CAPS topic, with assignments and tests that follow the same plan.',
  },
  {
    icon: LineChart,
    title: 'Progress you can see',
    body: 'Attendance, marks and weak topics tracked per subject, and visible to parents.',
  },
] as const;

export default function PromiseSection() {
  return (
    <>
      <WaveDivider from="cream" />

      <section className="relative overflow-hidden bg-brand-blue">
        <OceanDecor />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            {/* Script accent, used for one short phrase only (Design.md section 2). */}
            <p className="font-script text-3xl text-brand-amber sm:text-4xl">
              More than extra lessons.
            </p>

            <h2 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Progress you can actually see.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-white/80 sm:text-[17px]">
              Every lesson is planned, tracked and tied back to the curriculum, so
              students know what to do next and parents know where things stand.
            </p>
          </div>

          <ul className="mt-12 grid gap-8 sm:grid-cols-3 lg:mt-16 lg:gap-10">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex flex-col items-center text-center">
                {/* Circular icon on a tinted disc (Design.md section 6). */}
                <span
                  aria-hidden="true"
                  className="flex size-16 items-center justify-center rounded-full bg-white/10 text-brand-amber ring-1 ring-white/20"
                >
                  <Icon className="size-7" strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-white/75">{body}</p>
              </li>
            ))}
          </ul>

          {/* 16/9 rather than a wider band: the source is 1.83:1, so this crops
              a sliver off the sides instead of cutting off heads. */}
          <div className="mx-auto mt-14 max-w-4xl lg:mt-20">
            <ImagePlaceholder
              src="/lesson.png"
              alt="A tutor leaning over a table, pointing at a calculation while three high-school students work through it in their books"
              tone="light"
              aspect="aspect-[16/9]"
              label="Photo of a lesson in progress"
              sizes="(min-width: 1024px) 56rem, 92vw"
            />
          </div>
        </div>
      </section>

      <WaveDivider from="blue" />
    </>
  );
}

/**
 * Fish and bubbles from Design.md section 4. Decorative, kept away from text,
 * and dropped on narrow viewports (section 9).
 */
function OceanDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      <Fish className="absolute top-16 left-10 size-10 text-white/15" />
      <Fish className="absolute top-1/2 right-14 size-14 -scale-x-100 text-white/10" />
      <Fish className="absolute bottom-24 left-1/4 size-8 text-white/10" />

      {[
        'top-24 right-1/3 size-2.5',
        'top-40 right-1/4 size-1.5',
        'bottom-32 left-16 size-2',
        'bottom-48 left-1/3 size-1.5',
      ].map((position) => (
        <span key={position} className={`absolute rounded-full bg-white/20 ${position}`} />
      ))}
    </div>
  );
}

function Fish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" fill="currentColor" className={className}>
      <path d="M40 16c0 7-9 12-18 12-7 0-13-3-16-8 3-5 9-8 16-8 9 0 18 5 18 12Z" />
      <path d="M44 16 62 6v20L44 16Z" />
    </svg>
  );
}
