import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { connectDB } from '@/lib/mongodb';
import { Subject } from '@/models';
import { bookabilityBlockers, listTutorsForAdmin } from '@/services/tutor.service';
import { MODE_LABELS } from '@/types/booking';
import TutorApproval from '@/components/admin/TutorApproval';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';

export const dynamic = 'force-dynamic';

/**
 * Tutor approval (brief section 12).
 *
 * A tutor registration creates a User that cannot sign in and a Tutor that is
 * not visible for booking. Approving here flips both, which is why the queue
 * leads the page - nothing about a tutor works until someone acts on it.
 */
export default async function AdminTutorsPage() {
  await requireRole('admin', '/admin/tutors');

  await connectDB();

  const [tutors, subjects] = await Promise.all([
    listTutorsForAdmin(),
    Subject.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
  ]);

  const subjectOptions = subjects.map((subject) => ({
    subjectId: subject._id.toString(),
    name: subject.name,
  }));

  const awaiting = tutors.filter((tutor) => !tutor.isVerified);
  const approved = tutors.filter((tutor) => tutor.isVerified);
  const bookable = approved.filter(
    (tutor) => bookabilityBlockers(tutor).length === 0
  );

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Tutors
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
            Approving a tutor lets them sign in and puts them in front of
            students. They also need a rate, at least one subject and some
            availability before anyone can book them.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Awaiting approval"
            value={awaiting.length}
            detail="cannot sign in yet"
            highlight={awaiting.length > 0}
          />
          <StatTile label="Approved" value={approved.length} detail="tutors" />
          <StatTile label="Bookable" value={bookable.length} detail="fully set up" />
        </div>

        <DashboardSection
          title="Awaiting approval"
          description="These accounts cannot sign in until you approve them."
          count={awaiting.length}
          emptyTitle="Nothing waiting"
          emptyBody="New tutor registrations appear here for vetting before they can reach the platform."
        >
          <ul className="space-y-3">
            {awaiting.map((tutor) => (
              <li key={tutor.tutorId}>
                <TutorCard tutor={tutor} subjects={subjectOptions} />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Approved tutors"
          count={approved.length}
          emptyTitle="No approved tutors yet"
          emptyBody="Once you approve a tutor they will be listed here."
        >
          <ul className="space-y-3">
            {approved.map((tutor) => (
              <li key={tutor.tutorId}>
                <TutorCard tutor={tutor} subjects={subjectOptions} />
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}

function TutorCard({
  tutor,
  subjects,
}: {
  tutor: Awaited<ReturnType<typeof listTutorsForAdmin>>[number];
  subjects: { subjectId: string; name: string }[];
}) {
  const blockers = bookabilityBlockers(tutor);

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-brand-navy">
            {tutor.name}
            {!tutor.isVerified ? (
              <span className="rounded-full bg-brand-amber/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-amber-text uppercase">
                Awaiting approval
              </span>
            ) : !tutor.isActive ? (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-red-700 uppercase">
                Deactivated
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-green-800 uppercase">
                Active
              </span>
            )}
          </h3>

          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-brand-slate">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            {tutor.email}
          </p>

          <p className="mt-1 text-[13px] text-brand-slate">
            {tutor.hourlyRate ? `R${tutor.hourlyRate}/hr` : 'No rate set'} ·{' '}
            {tutor.subjectNames.length > 0
              ? tutor.subjectNames.join(', ')
              : 'No subjects'}{' '}
            ·{' '}
            {tutor.teachingModes.length > 0
              ? tutor.teachingModes.map((mode) => MODE_LABELS[mode]).join(', ')
              : 'No format'}
          </p>

          {tutor.activeBookings > 0 ? (
            <p className="mt-1 text-[13px] font-semibold text-brand-blue">
              {tutor.activeBookings} live booking
              {tutor.activeBookings === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
      </header>

      {tutor.bio ? (
        <p className="mt-3 text-[14px] leading-relaxed text-brand-slate">{tutor.bio}</p>
      ) : null}

      {tutor.qualifications.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {tutor.qualifications.map((qualification) => (
            <li
              key={qualification}
              className="rounded-full bg-brand-blue-50 px-3 py-1 text-[12px] font-semibold text-brand-navy"
            >
              {qualification}
            </li>
          ))}
        </ul>
      ) : null}

      {blockers.length > 0 ? (
        <div className="mt-3 rounded-xl bg-brand-amber/10 p-3">
          <p className="text-[13px] font-bold text-brand-amber-text">
            Not bookable yet:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-brand-navy">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <TutorApproval
          tutorId={tutor.tutorId}
          isVerified={tutor.isVerified}
          isActive={tutor.isActive}
          hourlyRate={tutor.hourlyRate}
          subjectIds={tutor.subjectIds}
          teachingModes={tutor.teachingModes}
          subjects={subjects}
        />
      </div>
    </article>
  );
}
