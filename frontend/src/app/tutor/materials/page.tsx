import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { connectDB } from '@/lib/mongodb';
import { Grade, Subject } from '@/models';
import { listMaterialsForTutor } from '@/services/material.service';
import { isCloudinaryConfigured } from '@/lib/cloudinary';
import MaterialUploader from '@/components/tutor/MaterialUploader';
import MaterialCard from '@/components/materials/MaterialCard';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import { STAFF_ROLES } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/**
 * A tutor's study materials (CLAUDE.md section 16).
 *
 * Scoped to what this tutor uploaded, so one tutor cannot edit or delete
 * another's work. Admins see everything.
 */
export default async function TutorMaterialsPage() {
  const user = await requireRole(STAFF_ROLES, '/tutor/materials');

  await connectDB();

  const [materials, subjects, grades] = await Promise.all([
    listMaterialsForTutor(user),
    Subject.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
    Grade.find({ isActive: true }).select('name level').sort({ level: 1 }).lean(),
  ]);

  const published = materials.filter((material) => material.isPublished);
  const downloads = materials.reduce((sum, material) => sum + material.downloads, 0);

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
            Study materials
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
            Notes, worksheets, past papers and videos. Students see published
            materials for their own grade.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Materials" value={materials.length} detail="uploaded" />
          <StatTile label="Published" value={published.length} detail="visible to students" />
          <StatTile label="Downloads" value={downloads} detail="all time" />
        </div>

        {isCloudinaryConfigured() ? (
          <MaterialUploader
            subjects={subjects.map((subject) => ({
              subjectId: subject._id.toString(),
              name: subject.name,
            }))}
            grades={grades.map((grade) => ({
              gradeId: grade._id.toString(),
              name: grade.name,
            }))}
          />
        ) : (
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-[17px] font-bold text-brand-navy">
              File uploads are not switched on
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">
              Set <code className="rounded bg-brand-blue-50 px-1.5 py-0.5">CLOUDINARY_CLOUD_NAME</code>,{' '}
              <code className="rounded bg-brand-blue-50 px-1.5 py-0.5">CLOUDINARY_API_KEY</code> and{' '}
              <code className="rounded bg-brand-blue-50 px-1.5 py-0.5">CLOUDINARY_API_SECRET</code>{' '}
              in the environment to upload materials.
            </p>
          </div>
        )}

        <DashboardSection
          title="Your materials"
          count={materials.length}
          emptyTitle="Nothing uploaded yet"
          emptyBody="Upload notes, a worksheet or a past paper and it will appear here, ready to publish to a grade."
        >
          <ul className="space-y-3">
            {materials.map((material) => (
              <li key={material.materialId}>
                <MaterialCard material={material} canManage />
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}
