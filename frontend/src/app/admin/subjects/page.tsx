import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { listSubjectsForAdmin } from '@/services/subject.service';
import SubjectManager from '@/components/admin/SubjectManager';

export const dynamic = 'force-dynamic';

/** Subject management (brief sections 5 and 12). Admin only. */
export default async function AdminSubjectsPage() {
  await requireRole(STAFF_ROLES, '/admin/subjects');

  const subjects = await listSubjectsForAdmin();

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          Subjects
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
          What students can book. Deactivating a subject removes it from the
          booking form while keeping past lessons and results intact.
        </p>

        <div className="mt-8">
          <SubjectManager subjects={subjects} />
        </div>
      </div>
    </section>
  );
}
