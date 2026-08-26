'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Loader2, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Ends the session and returns to the public home page.
 *
 * redirect:true so the browser performs a full navigation rather than a client
 * transition: that discards the router cache, so pressing Back cannot paint a
 * dashboard the signed-out user is no longer entitled to see.
 */
export default function LogoutButton({
  className,
  block,
  onDone,
}: {
  className?: string;
  block?: boolean;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        onDone?.();
        void signOut({ callbackUrl: '/', redirect: true });
      }}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-blue px-5 text-[15px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60',
        block && 'w-full',
        className
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      {busy ? 'Signing out' : 'Log Out'}
    </button>
  );
}
