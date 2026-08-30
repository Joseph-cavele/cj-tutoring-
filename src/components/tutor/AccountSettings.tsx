'use client';

import { useState, useTransition } from 'react';
import { AtSign, Check, KeyRound, Loader2 } from 'lucide-react';

import { changeEmailAction, changePasswordAction } from '@/actions/account.actions';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Change the email address and password on your own account.
 *
 * Two separate forms rather than one: they fail for different reasons and
 * succeed independently, and a single Save that changed both at once would
 * make a wrong current password look like it rejected the email too.
 *
 * Both send the current password. The server checks it again - this field is
 * a prompt, not the security.
 */

type Issues = Record<string, string>;

/** Field errors from an action result, keyed by field name. */
function issuesFrom(result: {
  ok: boolean;
  issues?: { field: string; message: string }[];
}): Issues {
  const map: Issues = {};

  for (const issue of result.issues ?? []) map[issue.field] = issue.message;

  return map;
}

export default function AccountSettings({ currentEmail }: { currentEmail: string }) {
  return (
    <div className="space-y-4">
      <EmailForm currentEmail={currentEmail} />
      <PasswordForm />
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand-blue">
          {icon}
        </span>
        <div>
          <h2 className="text-[18px] font-extrabold text-brand-navy">{title}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">{description}</p>
        </div>
      </header>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function Saved({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-[14px] font-semibold text-green-800"
    >
      <Check className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1.5 text-[13px] text-red-600">{message}</p>;
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [issues, setIssues] = useState<Issues>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIssues({});
    setSaved(null);

    startTransition(async () => {
      const result = await changeEmailAction({ email, currentPassword });

      if (!result.ok) {
        setError(result.error);
        setIssues(issuesFrom(result));
        return;
      }

      // Cleared so a shared device is not left with the password sitting in
      // a field.
      setCurrentPassword('');
      setSaved(`You will sign in with ${email} from now on.`);
    });
  };

  return (
    <Card
      icon={<AtSign className="size-5" />}
      title="Email address"
      description="This is what you sign in with, and where we send your notifications. We email both the old and the new address to confirm the change."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="new-email" className="block text-[14px] font-semibold text-brand-navy">
            Email address
          </label>
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(issues.email)}
            className={`${FIELD_CLASS} mt-1`}
          />
          <FieldError message={issues.email} />
        </div>

        <div>
          <label
            htmlFor="email-current-password"
            className="block text-[14px] font-semibold text-brand-navy"
          >
            Your current password
          </label>
          <input
            id="email-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            aria-invalid={Boolean(issues.currentPassword)}
            className={`${FIELD_CLASS} mt-1`}
          />
          <FieldError message={issues.currentPassword} />
        </div>

        {error ? <ErrorNote message={error} /> : null}
        {saved ? <Saved message={saved} /> : null}

        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            'Change email'
          )}
        </button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [issues, setIssues] = useState<Issues>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIssues({});
    setSaved(false);

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        password,
        confirmPassword,
      });

      if (!result.ok) {
        setError(result.error);
        setIssues(issuesFrom(result));
        return;
      }

      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      setSaved(true);
    });
  };

  return (
    <Card
      icon={<KeyRound className="size-5" />}
      title="Password"
      description="At least 8 characters, with an uppercase letter, a lowercase letter and a number. Changing it signs you out everywhere and cancels any outstanding reset link."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="current-password"
            className="block text-[14px] font-semibold text-brand-navy"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            aria-invalid={Boolean(issues.currentPassword)}
            className={`${FIELD_CLASS} mt-1`}
          />
          <FieldError message={issues.currentPassword} />
        </div>

        <div>
          <label htmlFor="new-password" className="block text-[14px] font-semibold text-brand-navy">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(issues.password)}
            className={`${FIELD_CLASS} mt-1`}
          />
          <FieldError message={issues.password} />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-[14px] font-semibold text-brand-navy"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(issues.confirmPassword)}
            className={`${FIELD_CLASS} mt-1`}
          />
          <FieldError message={issues.confirmPassword} />
        </div>

        {error ? <ErrorNote message={error} /> : null}
        {saved ? (
          <div className="space-y-2">
            <Saved message="Your password has been changed." />
            {/* The change signs out every session, including this one, so the
                next page they open would bounce to login without explanation. */}
            <p className="rounded-xl bg-brand-blue-50/60 p-3 text-[14px] leading-relaxed text-brand-navy">
              You have been signed out on every device, including this one.{' '}
              <a href="/login" className="font-semibold text-brand-blue hover:underline">
                Sign in again
              </a>{' '}
              with your new password.
            </p>
          </div>
        ) : null}

        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            'Change password'
          )}
        </button>
      </form>
    </Card>
  );
}
