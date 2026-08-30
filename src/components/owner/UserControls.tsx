'use client';

import { useState, useTransition } from 'react';
import { Link2, Loader2, ShieldCheck, UserMinus, X } from 'lucide-react';

import {
  changeUserRoleAction,
  linkParentAction,
  setUserActiveAction,
  unlinkParentAction,
} from '@/actions/user.actions';
import { ROLES, type Role } from '@/models/types';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * Admin controls for one account.
 *
 * Every button here is a request, not a decision. The actions re-check the
 * admin role, and the service refuses the dangerous cases - deactivating
 * yourself, or removing the last administrator - so those cannot be reached by
 * calling the action directly either.
 */

export function AccountToggle({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return (
      <p className="text-[13px] text-brand-slate">
        This is your own account.
      </p>
    );
  }

  const toggle = () => {
    setError(null);

    startTransition(async () => {
      const result = await setUserActiveAction({ userId, isActive: !isActive });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={
          isActive
            ? 'inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-red-200 px-4 text-[14px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60'
            : 'inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-brand-blue px-4 text-[14px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 disabled:opacity-60'
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <UserMinus className="size-4" aria-hidden="true" />
        )}
        {isActive ? 'Deactivate account' : 'Reactivate account'}
      </button>

      {error ? (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}

export function RoleControl({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: Role;
  isSelf: boolean;
}) {
  const [next, setNext] = useState<Role>(role);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isSelf) return null;

  const apply = (value: Role) => {
    setNext(value);
    setError(null);

    startTransition(async () => {
      const result = await changeUserRoleAction({ userId, role: value });

      if (!result.ok) {
        setError(result.error);
        // Never show a role the database does not actually hold.
        setNext(role);
      }
    });
  };

  return (
    <div>
      <label
        htmlFor={`role-${userId}`}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy"
      >
        <ShieldCheck className="size-3.5 text-brand-blue" aria-hidden="true" />
        Role
      </label>

      <div className="mt-1 flex items-center gap-2">
        <select
          id={`role-${userId}`}
          value={next}
          disabled={pending}
          onChange={(event) => apply(event.target.value as Role)}
          className={`${FIELD_CLASS} max-w-44 capitalize`}
        >
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        {pending ? (
          <Loader2 className="size-4 animate-spin text-brand-blue" aria-hidden="true" />
        ) : null}
      </div>

      {error ? (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Linking children to a parent.
 *
 * This is what a parent account is for - without a link their dashboard is
 * empty and they cannot book for anyone - so it is the most prominent control
 * on a parent's card.
 */
export function ParentChildren({
  parentId,
  linkedChildren,
  students,
}: {
  parentId: string;
  linkedChildren: { studentId: string; name: string }[];
  students: { studentId: string; name: string; email: string; gradeName: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [chosen, setChosen] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const linkedIds = new Set(linkedChildren.map((child) => child.studentId));
  const available = students.filter((student) => !linkedIds.has(student.studentId));

  const link = () => {
    if (!chosen) return;
    setError(null);

    startTransition(async () => {
      const result = await linkParentAction({ parentId, studentId: chosen });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setChosen('');
      setAdding(false);
    });
  };

  const unlink = (studentId: string) => {
    setError(null);

    startTransition(async () => {
      const result = await unlinkParentAction({ parentId, studentId });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="rounded-xl bg-brand-blue-50/60 p-3">
      <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
        Children
      </p>

      {linkedChildren.length === 0 ? (
        <p className="mt-1.5 text-[14px] text-brand-slate">
          None linked. This parent sees an empty dashboard and cannot book
          lessons until a child is linked.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {linkedChildren.map((child) => (
            <li
              key={child.studentId}
              className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pr-1 pl-3 text-[13px] font-semibold text-brand-navy"
            >
              {child.name}
              <button
                type="button"
                disabled={pending}
                onClick={() => unlink(child.studentId)}
                aria-label={`Unlink ${child.name}`}
                className="rounded-full p-1 text-brand-slate hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3">
          <label htmlFor={`child-${parentId}`} className="sr-only">
            Choose a student to link
          </label>
          <select
            id={`child-${parentId}`}
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">Choose a student&hellip;</option>
            {available.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.name}
                {student.gradeName ? ` — ${student.gradeName}` : ''} ({student.email})
              </option>
            ))}
          </select>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={link}
              disabled={pending || !chosen}
              className={PRIMARY_BUTTON}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Link2 className="size-4" aria-hidden="true" />
              )}
              Link child
            </button>

            <button
              type="button"
              onClick={() => setAdding(false)}
              disabled={pending}
              className={SECONDARY_BUTTON}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={available.length === 0}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-brand-blue bg-white px-4 text-[14px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 disabled:opacity-60"
        >
          <Link2 className="size-4" aria-hidden="true" />
          {available.length === 0 ? 'No students to link' : 'Link a child'}
        </button>
      )}

      {error ? (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
