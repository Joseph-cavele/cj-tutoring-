import Link from 'next/link';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { listApplications, type ApplicationView } from '@/services/application.service';
import ApplicationDecision from '@/components/tutor/ApplicationDecision';
import DashboardSection from '@/components/dashboard/DashboardSection';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  parent: 'Parent',
  tutor: 'Tutor',
  admin: 'Admin',
};

/**
 * Who is waiting to be let in (the tutor's front door).
 *
 * Everyone who registers lands here first and cannot sign in until the tutor
 * answers, so this page is the one thing standing between a stranger and a
 * platform holding children's marks and attendance.
 */
export default async function TutorApplicationsPage() {
  // Staff only, checked here as well as at the edge.
  await requireRole(STAFF_ROLES, '/tutor/applications');

  const [pending, rejected] = await Promise.all([
    listApplications('pending'),
    listApplications('rejected'),
  ]);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Applications
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Students, parents and tutors waiting to join. Nobody can sign in
            until you accept them.
          </p>
        </div>

        <DashboardSection
          title="Waiting for you"
          description="Oldest first, so nobody sits behind a newer application."
          count={pending.length}
          emptyTitle="Nobody is waiting"
          emptyBody="New registrations appear here for you to accept or decline. Everyone who applies is emailed as soon as you answer."
        >
          <ul className="space-y-3">
            {pending.map((application) => (
              <li key={application.userId}>
                <ApplicationCard application={application}>
                  <ApplicationDecision
                    userId={application.userId}
                    name={application.name}
                  />
                </ApplicationCard>
              </li>
            ))}
          </ul>
        </DashboardSection>

        {rejected.length > 0 ? (
          <DashboardSection
            title="Declined"
            description="Kept so the email address stays taken and the decision is on record. Accepting one here still opens their account."
            count={rejected.length}
            emptyTitle=""
            emptyBody=""
          >
            <ul className="space-y-3">
              {rejected.map((application) => (
                <li key={application.userId}>
                  <ApplicationCard application={application}>
                    <ApplicationDecision
                      userId={application.userId}
                      name={application.name}
                    />
                  </ApplicationCard>
                </li>
              ))}
            </ul>
          </DashboardSection>
        ) : null}
      </div>
    </section>
  );
}

function ApplicationCard({
  application,
  children,
}: {
  application: ApplicationView;
  children: React.ReactNode;
}) {
  const applied = new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(application.appliedAt));

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-extrabold text-brand-navy">{application.name}</h3>
        <span className="rounded-full bg-brand-blue-50 px-3 py-1 text-[12px] font-bold text-brand-blue uppercase">
          {ROLE_LABEL[application.role] ?? application.role}
        </span>
      </header>

      <p className="mt-1 text-[14px] text-brand-slate">
        {application.detail} · Applied {applied}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px]">
        <a
          href={`mailto:${application.email}`}
          className="inline-flex items-center gap-1.5 font-semibold text-brand-blue hover:underline"
        >
          <Mail className="size-4" aria-hidden="true" />
          {application.email}
        </a>

        {application.phone ? (
          <a
            href={`tel:${application.phone}`}
            className="inline-flex items-center gap-1.5 font-semibold text-brand-blue hover:underline"
          >
            <Phone className="size-4" aria-hidden="true" />
            {application.phone}
          </a>
        ) : null}
      </div>

      {application.decisionNote ? (
        <p className="mt-3 rounded-xl bg-brand-blue-50/60 p-3 text-[14px] text-brand-navy">
          Your note: {application.decisionNote}
        </p>
      ) : null}

      <div className="mt-4">{children}</div>
    </article>
  );
}
