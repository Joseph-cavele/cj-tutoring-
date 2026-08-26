import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { connectDB } from '@/lib/mongodb';
import { Grade, Subject } from '@/models';
import {
  bookabilityBlockers,
  getMyTutorProfile,
  hasAvailability,
} from '@/services/tutor.service';
import ProfileEditor from '@/components/tutor/ProfileEditor';
import { SECONDARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * A tutor's own profile.
 *
 * Leads with whether they are actually bookable, because a tutor with no rate
 * or no availability sees an empty dashboard and no explanation otherwise.
 */
export default async function TutorProfilePage() {
  const user = await requireRole('tutor', '/tutor/profile');

  await connectDB();

  const [profile, subjects, grades] = await Promise.all([
    getMyTutorProfile(user),
    Subject.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
    Grade.find({ isActive: true }).select('name level').sort({ level: 1 }).lean(),
  ]);

  if (!profile) {
    return (
      <section className="bg-brand-cream py-16">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
          <p className="rounded-2xl bg-white p-6 text-[15px] text-brand-slate shadow-[var(--shadow-soft)]">
            Your tutor profile is not set up yet. Please contact the office.
          </p>
        </div>
      </section>
    );
  }

  const blockers = bookabilityBlockers(profile);
  const availability = await hasAvailability(profile.tutorId);

  if (!availability) blockers.push('No availability set, so there are no times to book');

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            My profile
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            {profile.name} · {profile.email}
          </p>
        </div>

        {blockers.length === 0 ? (
          <div className="flex gap-3 rounded-2xl bg-green-50 p-5">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-green-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-[16px] font-bold text-green-900">
                You are live and bookable
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-green-900">
                Students choosing your subjects will see you, with your open
                times.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-2xl bg-brand-amber/15 p-5">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-brand-amber-text"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-[16px] font-bold text-brand-amber-text">
                Students cannot book you yet
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-brand-navy">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>

              {!availability ? (
                <Link href="/tutor/availability" className={`${SECONDARY_BUTTON} mt-4`}>
                  Set your availability
                </Link>
              ) : null}
            </div>
          </div>
        )}

        <ProfileEditor
          initial={{
            bio: profile.bio,
            qualifications: profile.qualifications,
            hourlyRate: profile.hourlyRate,
            subjectIds: profile.subjectIds,
            gradeIds: profile.gradeIds,
            teachingModes: profile.teachingModes,
            profileImage: profile.profileImage,
          }}
          subjects={subjects.map((subject) => ({
            subjectId: subject._id.toString(),
            name: subject.name,
          }))}
          grades={grades.map((grade) => ({
            gradeId: grade._id.toString(),
            name: grade.name,
          }))}
        />
      </div>
    </section>
  );
}
