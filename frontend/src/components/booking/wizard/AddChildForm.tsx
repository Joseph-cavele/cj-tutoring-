'use client';

import { useState, useTransition } from 'react';
import { Loader2, MailCheck, UserPlus, X } from 'lucide-react';

import { addChildAction } from '@/actions/booking.actions';
import { GRADES } from '@/lib/curriculum';
import { ErrorNote, Field, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * A parent adds a child mid-booking (brief section 4).
 *
 * No password field, deliberately: the child is emailed a one-time link and
 * chooses their own, so the parent never sets or knows their credentials. The
 * child is bookable immediately - accepting the invite is only what lets them
 * sign in themselves.
 */
export default function AddChildForm({
  onAdded,
}: {
  /** Called with the new studentId so the wizard can select them. */
  onAdded: (studentId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gradeLevel, setGradeLevel] = useState<number>(10);

  const [error, setError] = useState<string | null>(null);
  const [notInvited, setNotInvited] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await addChildAction({
        name,
        email,
        phone: phone || undefined,
        gradeLevel,
      });

      if (!result.ok) {
        setError(
          result.issues?.length ? result.issues[0].message : result.error
        );
        return;
      }

      // Added either way; the invitation email is the part that can fail.
      if (!result.data.invited) setNotInvited(true);

      onAdded(result.data.studentId, result.data.name);
      setOpen(false);
      setName('');
      setEmail('');
      setPhone('');
    });
  };

  if (notInvited && !open) {
    return (
      <div className="rounded-2xl bg-brand-amber/15 p-4">
        <p className="flex items-start gap-2 text-[14px] leading-relaxed text-brand-navy">
          <MailCheck
            className="mt-0.5 size-4 shrink-0 text-brand-amber-text"
            aria-hidden="true"
          />
          <span>
            Your child has been added and you can book for them now, but the
            invitation email could not be sent. Ask the office to resend it so
            they can sign in themselves.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setNotInvited(false)}
          className="mt-2 text-[13px] font-semibold text-brand-blue underline underline-offset-2"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY_BUTTON}>
        <UserPlus className="size-4" aria-hidden="true" />
        Add a child
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-2xl border-[1.5px] border-brand-blue bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-bold text-brand-navy">Add a child</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="rounded-full p-2 text-brand-slate hover:bg-brand-blue-50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full name" htmlFor="child-name">
            <input
              id="child-name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Thandi Mokoena"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Their email address"
            htmlFor="child-email"
            hint="We email them a link to choose their own password. You will not need to set one."
          >
            <input
              id="child-email"
              type="email"
              required
              maxLength={200}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="thandi@example.com"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        <Field label="Grade" htmlFor="child-grade">
          <select
            id="child-grade"
            value={gradeLevel}
            onChange={(event) => setGradeLevel(Number(event.target.value))}
            className={FIELD_CLASS}
          >
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Phone (optional)" htmlFor="child-phone">
          <input
            id="child-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0710836571"
            className={FIELD_CLASS}
          />
        </Field>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || name.trim().length < 2 || !email}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Adding&hellip;
            </>
          ) : (
            'Add child'
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
