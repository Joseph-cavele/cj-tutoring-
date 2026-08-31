'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';

import { redeemParentInviteAction } from '@/actions/parent-invite.actions';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Where a parent enters the code their tutor gave them (brief section 2).
 *
 * Typing is the enemy on a phone, so the field is `inputMode="latin"` with
 * autocapitalise on and autocorrect off: a parent copying a code off a
 * WhatsApp message should not have it "helpfully" rewritten. The service
 * repairs the rest - lower case, missing hyphen, O typed for zero.
 *
 * No client-side format validation on purpose. A regex here would reject the
 * very misreads the normaliser exists to fix, and the parent would be stuck
 * with "invalid code" for a code that actually works.
 */
export default function ClaimChildForm({ compact = false }: { compact?: boolean }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; alreadyLinked: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDone(null);

    startTransition(async () => {
      const result = await redeemParentInviteAction({ code });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDone({ name: result.data.studentName, alreadyLinked: result.data.alreadyLinked });
      setCode('');
    });
  };

  if (done) {
    return (
      <div
        className="rounded-2xl bg-brand-blue-50 p-5 text-center"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2
          className="mx-auto size-6 text-brand-blue"
          aria-hidden="true"
        />
        <p className="mt-2 text-[15px] font-bold text-brand-navy">
          {done.alreadyLinked
            ? `${done.name} was already on your account`
            : `${done.name} is now linked to your account`}
        </p>
        <p className="mt-1 text-[14px] text-brand-slate">
          You can see their lessons, attendance, results and payments below.
        </p>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="mt-3 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          Add another child
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={compact ? '' : 'mx-auto max-w-md text-left'}>
      <label
        htmlFor="invite-code"
        className="block text-[14px] font-semibold text-brand-navy"
      >
        Invitation code
      </label>
      <p className="mt-1 text-[13px] text-brand-slate">
        Ten characters, like ABCDE-FGHJK. Your tutor gives you one for each child.
      </p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="invite-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={pending}
          placeholder="ABCDE-FGHJK"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          aria-describedby={error ? 'invite-code-error' : undefined}
          aria-invalid={error ? true : undefined}
          className={`${FIELD_CLASS} font-mono tracking-[0.15em] uppercase placeholder:tracking-normal placeholder:normal-case`}
        />

        <button type="submit" disabled={pending || !code.trim()} className={PRIMARY_BUTTON}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4" aria-hidden="true" />
          )}
          {pending ? 'Checking' : 'Link my child'}
        </button>
      </div>

      {error ? (
        <div className="mt-2" id="invite-code-error">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </form>
  );
}
