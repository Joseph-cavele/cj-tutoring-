'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Loader2, UserPlus } from 'lucide-react';

import { createParentInviteAction } from '@/actions/parent-invite.actions';
import { ErrorNote, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * Issues a parent invitation code for one student (brief section 2).
 *
 * The code is shown ONCE and never again - the server only keeps a hash of it,
 * so there is nothing to show a second time. The UI has to make that obvious,
 * hence the copy button and the explicit warning. Losing one is cheap: issue
 * another and the old one can be withdrawn.
 */
export default function ParentInviteControl({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const issue = () => {
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await createParentInviteAction({ studentId });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCode(result.data.code);
      setExpiresAt(result.data.expiresAt);
    });
  };

  const copy = async () => {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard is blocked in some mobile browsers and over plain HTTP. The
      // code is on screen and selectable, so this is a convenience, not a
      // dependency - say nothing rather than show a scary error.
      setCopied(false);
    }
  };

  if (code) {
    const expiryLabel = expiresAt
      ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long' }).format(
          new Date(expiresAt)
        )
      : null;

    return (
      <div className="rounded-2xl bg-brand-blue-50 p-4" role="status" aria-live="polite">
        <p className="text-[13px] font-semibold text-brand-navy">
          Invitation code for {studentName}
        </p>

        <p className="mt-2 font-mono text-[22px] font-bold tracking-[0.2em] text-brand-navy">
          {code}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className={SECONDARY_BUTTON}>
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy code'}
          </button>

          <button
            type="button"
            onClick={() => {
              setCode(null);
              setExpiresAt(null);
              setCopied(false);
            }}
            className="text-[14px] font-semibold text-brand-blue hover:underline"
          >
            Done
          </button>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-brand-slate">
          Give this to the parent. It works once, for {studentName} only
          {expiryLabel ? `, and expires on ${expiryLabel}` : ''}.{' '}
          <strong className="font-semibold text-brand-navy">
            Copy it now - it cannot be shown again.
          </strong>
        </p>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={issue} disabled={pending} className={SECONDARY_BUTTON}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <UserPlus className="size-4" aria-hidden="true" />
        )}
        {pending ? 'Creating' : 'Invite a parent'}
      </button>

      {error ? (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
