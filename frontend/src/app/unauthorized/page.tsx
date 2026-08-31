import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, ShieldAlert, ArrowRight } from 'lucide-react';

import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'Access Restricted | CJ Private Tutoring',
  description: 'You do not have authorization to view this section.',
};

export default function UnauthorizedPage() {
  return (
    <main className="min-h-[85vh] flex items-center justify-center bg-brand-cream px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 sm:p-10 shadow-[var(--shadow-float)] text-center border border-brand-blue-100/60">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-6">
          <ShieldAlert className="size-8" />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-[12px] font-bold text-amber-900 uppercase tracking-wider mb-3">
          403 Forbidden
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
          Access Restricted
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-brand-slate">
          You are signed in, but your account does not have permission to access this page. Each role
          (tutor, student, parent) has its own dedicated dashboard and resources.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue shadow-sm"
          >
            Go to Your Dashboard
            <ArrowRight className="size-4" />
          </Link>
          <div className="flex justify-center items-center">
            <LogoutButton />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-brand-blue-100/60 flex items-center justify-center gap-2 text-brand-slate text-[13px]">
          <GraduationCap className="size-4 text-brand-blue" />
          <span>CJ Private Tutoring Platform</span>
        </div>
      </div>
    </main>
  );
}
