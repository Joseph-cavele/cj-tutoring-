import Image from 'next/image';
import { GraduationCap, Quote, UserRound, Users } from 'lucide-react';

/**
 * Testimonials, following the reference layout: a photo band with the heading
 * over it, a grid of alternating cards, then a stats row.
 *
 * Reference purple maps to brand blue - Design.md section 1 allows blue and
 * amber only.
 *
 * ============================================================================
 * SAMPLE CONTENT - REPLACE BEFORE LAUNCH
 * ----------------------------------------------------------------------------
 * The quotes, names and figures below are invented demo copy, here so the
 * layout can be judged. They are not real customers and not measured numbers.
 *
 * Publishing invented reviews or unverifiable statistics as genuine breaches
 * the Consumer Protection Act 68 of 2008 (false or misleading representations)
 * and the ASA Code. Swap in real quotes you have written permission to publish,
 * and figures you can evidence, before this page goes live.
 *
 * Everything to replace is in SAMPLE_TESTIMONIALS and SAMPLE_STATS below.
 * ============================================================================
 */
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  /** Headshot in /public, once you have permission to publish it. */
  avatar?: string;
};

const SAMPLE_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Her maths mark went from 48% to 67% in two terms, but the bigger change is that she no longer dreads the subject.',
    name: 'Thandi Mokoena',
    role: 'Parent, Grade 11 Mathematics',
  },
  {
    quote:
      'Trigonometry never made sense in a class of forty. One session going through it slowly and it finally clicked.',
    name: 'Sipho Ndlovu',
    role: 'Grade 12 Mathematics',
  },
  {
    quote:
      'I can log in and see exactly which lessons he attended and where he is struggling. No more guessing at parents evening.',
    name: 'Riaan van der Merwe',
    role: 'Parent, Grade 9 Mathematics',
  },
  {
    quote:
      'The exam block before finals was worth it on its own. We worked past papers until the pattern of the questions was obvious.',
    name: 'Ayesha Patel',
    role: 'Grade 12 Physical Science',
  },
  {
    quote:
      'Online lessons meant no driving across town after work. Same tutor every week, and the plan carried over properly.',
    name: 'Lerato Dlamini',
    role: 'Parent, Grade 10 Physical Science',
  },
  {
    quote:
      'He asks questions now instead of going quiet when he is lost. For us that mattered more than the mark did.',
    name: 'Michelle Botha',
    role: 'Parent, Grade 8 Mathematics',
  },
];

const SAMPLE_STATS = [
  { icon: GraduationCap, value: '450+', label: 'Students tutored' },
  { icon: Users, value: '12k+', label: 'Lessons delivered' },
  { icon: UserRound, value: '30+', label: 'Qualified tutors' },
];

export default function Testimonials() {
  return (
    <section className="bg-brand-cream pb-16 lg:pb-24">
      {/* Photo band with the heading over it, as in the reference. */}
      <div className="relative isolate overflow-hidden">
        <Image
          src="/family.png"
          alt=""
          width={1024}
          height={559}
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        {/* The overlay carries the contrast for the heading; without it the
            text sits on an unpredictable photo. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-blue/85" />

        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <p className="font-script text-3xl text-brand-amber sm:text-4xl">In their words</p>
          <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Trusted by families who want both confidence and results
          </h2>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Cards sit below the photo band rather than overlapping it. */}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_TESTIMONIALS.map((testimonial, index) => {
            const isFilled = index % 2 === 1;

            return (
              <li
                key={testimonial.name}
                className={`flex flex-col rounded-3xl p-6 shadow-[var(--shadow-float)] ${isFilled ? 'bg-brand-blue' : 'bg-white'
                  }`}
              >
                <Quote
                  aria-hidden="true"
                  className={`size-8 shrink-0 ${isFilled ? 'text-white/50' : 'text-brand-blue/30'}`}
                />

                <blockquote className="flex flex-1 flex-col">
                  <p
                    className={`mt-3 flex-1 text-[14px] leading-relaxed ${isFilled ? 'text-white/90' : 'text-brand-slate'
                      }`}
                  >
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>

                  <footer className="mt-5 flex items-center gap-3">
                    {testimonial.avatar ? (
                      <Image
                        src={testimonial.avatar}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${isFilled
                            ? 'bg-white/15 text-white/70'
                            : 'bg-brand-blue-50 text-brand-blue'
                          }`}
                      >
                        <UserRound className="size-5" />
                      </span>
                    )}

                    <div>
                      <p
                        className={`text-[14px] font-bold ${isFilled ? 'text-white' : 'text-brand-navy'
                          }`}
                      >
                        {testimonial.name}
                      </p>
                      <p
                        className={`text-[12px] ${isFilled ? 'text-white/70' : 'text-brand-slate'}`}
                      >
                        {testimonial.role}
                      </p>
                    </div>
                  </footer>
                </blockquote>
              </li>
            );
          })}
        </ul>

        {/* Stats row at the bottom, as in the reference. */}
        <ul className="mt-12 grid gap-8 rounded-3xl bg-white p-8 shadow-[var(--shadow-soft)] sm:grid-cols-3 lg:mt-16">
          {SAMPLE_STATS.map(({ icon: Icon, value, label }) => (
            <li key={label} className="flex items-center justify-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue"
              >
                <Icon className="size-7" />
              </span>
              <div>
                <p className="text-3xl font-extrabold text-brand-navy sm:text-4xl">{value}</p>
                <p className="text-[13px] text-brand-slate">{label}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
