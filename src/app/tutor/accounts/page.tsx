import Link from 'next/link';
import { ArrowLeft, Mail, Search } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import {
  listAllStudents,
  listUsersForAdmin,
  type AdminUserView,
} from '@/services/user-admin.service';
import { ROLES, type Role } from '@/models/types';
import {
  AccountToggle,
  ParentChildren,
  RoleControl,
} from '@/components/owner/UserControls';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import { FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * Account management (brief section 12).
 *
 * The main job this page does that nothing else can is linking a parent to a
 * child. Until that link exists a parent has an empty dashboard and cannot
 * book for anybody, and the relationship is stored on two documents, so it is
 * not something to do by hand in the database.
 */
export default async function AdminUsersPage(props: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const admin = await requireRole(STAFF_ROLES, '/tutor/accounts');

  // searchParams is a Promise in Next 16.
  const params = await props.searchParams;

  const role = (ROLES as readonly string[]).includes(params.role ?? '')
    ? (params.role as Role)
    : undefined;

  const query = params.q?.trim() || undefined;

  const [users, students] = await Promise.all([
    listUsersForAdmin({ role, query }),
    listAllStudents(),
  ]);

  const counts = ROLES.map((value) => ({
    role: value,
    count: users.filter((user) => user.role === value).length,
  }));

  const unlinkedParents = users.filter(
    (user) => user.profile.kind === 'parent' && user.profile.children.length === 0
  ).length;

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
            Users
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
            Accounts, roles, and which children each parent is linked to.
          </p>
        </div>

        {!role && !query ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {counts.map((entry) => (
              <StatTile key={entry.role} label={entry.role} value={entry.count} />
            ))}
            <StatTile
              label="Unlinked parents"
              value={unlinkedParents}
              detail="no children"
              highlight={unlinkedParents > 0}
            />
          </div>
        ) : null}

        {/* A plain GET form, so a filtered view is a shareable URL and needs
            no client-side state. */}
        <form
          action="/tutor/accounts"
          className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)] sm:flex-row"
        >
          <label className="flex-1">
            <span className="sr-only">Search by name or email</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand-slate"
                aria-hidden="true"
              />
              <input
                name="q"
                defaultValue={query ?? ''}
                placeholder="Search name or email"
                className={`${FIELD_CLASS} pl-11`}
              />
            </div>
          </label>

          <label>
            <span className="sr-only">Filter by role</span>
            <select
              name="role"
              defaultValue={role ?? ''}
              className={`${FIELD_CLASS} capitalize sm:w-44`}
            >
              <option value="">All roles</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className={PRIMARY_BUTTON}>
            Search
          </button>
        </form>

        <DashboardSection
          title={role ? `${role}s` : 'All accounts'}
          description={
            users.length === 100 ? 'Showing the 100 most recent. Search to narrow.' : undefined
          }
          count={users.length}
          emptyTitle="No accounts found"
          emptyBody={
            query || role
              ? 'Nothing matches that search. Try a different name, email or role.'
              : 'No accounts exist yet. They appear here as people register.'
          }
        >
          <ul className="space-y-3">
            {users.map((user) => (
              <li key={user.userId}>
                <UserCard user={user} students={students} actingUserId={admin.id} />
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}

function UserCard({
  user,
  students,
  actingUserId,
}: {
  user: AdminUserView;
  students: { studentId: string; name: string; email: string; gradeName: string }[];
  actingUserId: string;
}) {
  const isSelf = user.userId === actingUserId;

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-brand-navy">
            {user.name}
            <span className="rounded-full bg-brand-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-blue uppercase">
              {user.role}
            </span>
            {!user.isActive ? (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-red-700 uppercase">
                Cannot sign in
              </span>
            ) : null}
            {isSelf ? (
              <span className="rounded-full bg-brand-amber/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-amber-text uppercase">
                You
              </span>
            ) : null}
          </h3>

          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-brand-slate">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>

          <p className="mt-1 text-[13px] text-brand-slate">
            Joined{' '}
            {new Intl.DateTimeFormat('en-ZA', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }).format(new Date(user.createdAt))}
            {user.lastLoginAt
              ? ` · last signed in ${new Intl.DateTimeFormat('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                }).format(new Date(user.lastLoginAt))}`
              : ' · never signed in'}
          </p>
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <ProfileDetail user={user} students={students} />

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-brand-blue-100 pt-3">
          <RoleControl userId={user.userId} role={user.role} isSelf={isSelf} />
          <AccountToggle
            userId={user.userId}
            isActive={user.isActive}
            isSelf={isSelf}
          />
        </div>
      </div>
    </article>
  );
}

/** The role-specific part of a card. */
function ProfileDetail({
  user,
  students,
}: {
  user: AdminUserView;
  students: { studentId: string; name: string; email: string; gradeName: string }[];
}) {
  const { profile } = user;

  if (profile.kind === 'parent') {
    return (
      <ParentChildren
        parentId={profile.parentId}
        linkedChildren={profile.children}
        students={students}
      />
    );
  }

  if (profile.kind === 'student') {
    return (
      <div className="rounded-xl bg-brand-blue-50/60 p-3 text-[14px] text-brand-navy">
        <p>
          <span className="font-semibold">{profile.gradeName}</span>
          {profile.parents.length > 0
            ? ` · linked to ${profile.parents.map((parent) => parent.name).join(', ')}`
            : ' · no parent linked'}
        </p>
      </div>
    );
  }

  if (profile.kind === 'tutor') {
    return (
      <div className="rounded-xl bg-brand-blue-50/60 p-3 text-[14px] text-brand-navy">
        <p>
          {profile.isVerified ? 'Approved' : 'Awaiting approval'} ·{' '}
          {profile.isActive ? 'active' : 'deactivated'} · {profile.subjectCount} subject
          {profile.subjectCount === 1 ? '' : 's'}
        </p>
        <Link
          href="/tutor/team"
          className="mt-1 inline-block text-[13px] font-semibold text-brand-blue hover:underline"
        >
          Manage on the tutors page
        </Link>
      </div>
    );
  }

  if (profile.kind === 'missing') {
    // Usually a half-finished registration. Worth surfacing, because the
    // account will behave oddly until it is sorted out.
    return (
      <div className="rounded-xl bg-brand-amber/15 p-3 text-[14px] text-brand-navy">
        This account has no {profile.expected} profile, so parts of the platform
        will not work for them. It usually means registration did not finish.
      </div>
    );
  }

  return null;
}
