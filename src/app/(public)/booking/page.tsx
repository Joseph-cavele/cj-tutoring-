import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn } from 'lucide-react';

import { auth } from '@/auth';
import { getBookableStudents } from '@/services/lesson-booking.service';
import { getBookableSubjects } from '@/services/availability.service';
import BookingForm from '@/components/booking/BookingForm';
import BookingWizard from '@/components/booking/wizard/BookingWizard';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';
import type { SessionUser } from '@/lib/auth/guard';
import { nowInSast } from '@/lib/availability/slots';

export const metadata: Metadata = {
  title: 'Book a Lesson | CJ Private Tutoring',
  description:
    'Book a lesson with a CJ Private Tutoring tutor. Choose your subject, tutor, date and time.',
};

// Availability and the signed-in user both change per request.
export const dynamic = 'force-dynamic';

/**
 * The booking entry point.
 *
 * Signed-in students, parents and admins get the full five-step wizard, which
 * creates a real booking against a tutor's diary. Everyone else gets the
 * enquiry form, which asks the office to arrange a free trial - a visitor with
 * no account has no student record to book against, so there is nothing for
 * the wizard to attach a lesson to.
 */
export default async function BookingPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  const canBook = user && ['student', 'parent', 'tutor'].includes(user.role);

  return (
    <section className="bg-brand-cream pb-16 lg:pb-24">
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 lg:pt-14">
        <div className="text-center">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            {canBook ? 'Book a Lesson' : 'Book a Session'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-brand-slate">
            {canBook
              ? 'Choose the subject, the tutor and a time that suits you. Your tutor confirms the booking.'
              : 'Tell us the grade, the subject and when suits you. The first lesson is free.'}
          </p>
        </div>

        <div className="mt-8 lg:mt-10">
          {canBook ? <SignedInBooking user={user} /> : <SignedOutBooking />}
        </div>
      </div>
    </section>
  );
}

/** The real booking flow. Options are loaded server-side and scoped to the user. */
async function SignedInBooking({ user }: { user: SessionUser }) {
  const [students, subjects] = await Promise.all([
    getBookableStudents(user),
    getBookableSubjects(),
  ]);

  return (
    <BookingWizard
      students={students}
      subjects={subjects}
      role={user.role}
      // Computed on the server so the earliest bookable day matches South
      // African time regardless of the device clock or the host's timezone.
      minDate={nowInSast().isoDate}
    />
  );
}

/** Enquiry route for visitors, plus a nudge towards the full flow. */
function SignedOutBooking() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-blue-100 bg-brand-blue-50/50 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-brand-navy">
          <LogIn className="size-5 text-brand-blue" aria-hidden="true" />
          Already with us?
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">
          Sign in to book a specific tutor at a specific time and see their live
          availability.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login?callbackUrl=%2Fbooking" className={PRIMARY_BUTTON}>
            Sign in to book
          </Link>
          <Link href="/register" className={SECONDARY_BUTTON}>
            Create an account
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-[17px] font-bold text-brand-navy">
          Or request a free trial lesson
        </h2>
        <p className="mt-1.5 text-[14px] text-brand-slate">
          We will phone or email you to arrange a time.
        </p>
        <div className="mt-4">
          <BookingForm />
        </div>
      </div>
    </div>
  );
}
