'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { GRADES, SUBJECTS, isSupported } from '@/lib/curriculum';
import { bookingSchema, type BookingInput } from '@/validations/booking';

const FIELD =
  'min-h-12 w-full rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-4 text-[15px] text-brand-navy placeholder:text-brand-slate/60 focus:border-brand-blue focus:bg-white focus:outline-2 focus:outline-offset-1 focus:outline-brand-blue';

const MODES = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Either is fine' },
] as const;

export default function BookingForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subjectSlug: 'mathematics',
      grade: 10,
      mode: 'online',
      preferredDate: '',
      preferredTime: '',
      notes: '',
      company: '',
    },
  });

  // Physical Science only exists from Grade 10, so the subject list narrows
  // with the chosen grade rather than letting an invalid pair be submitted.
  const selectedGrade = Number(watch('grade')) || 10;
  const availableSubjects = Object.values(SUBJECTS).filter((subject) =>
    isSupported(selectedGrade, subject.slug)
  );

  const onSubmit = async (values: BookingInput) => {
    setFormError(null);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error ?? 'Could not send your request. Please try again.');
        return;
      }

      setSent(true);
    } catch {
      setFormError('No connection. Please check your network and try again.');
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-soft)]">
        <CheckCircle2 className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold text-brand-navy">Request received</h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-brand-slate">
          We will confirm your trial lesson by email or phone, usually within one
          working day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8 lg:p-10"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <input id="name" autoComplete="name" placeholder="Thandi Mokoena" className={FIELD} {...register('name')} />
        </Field>

        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={FIELD} {...register('email')} />
        </Field>

        <Field label="Grade" htmlFor="grade" error={errors.grade?.message}>
          <select id="grade" className={FIELD} {...register('grade', { valueAsNumber: true })}>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subject" htmlFor="subjectSlug" error={errors.subjectSlug?.message}>
          <select id="subjectSlug" className={FIELD} {...register('subjectSlug')}>
            {availableSubjects.map((subject) => (
              <option key={subject.slug} value={subject.slug}>
                {subject.name}
              </option>
            ))}
          </select>
          {availableSubjects.length === 1 && (
            <p className="mt-1.5 text-[12px] text-brand-slate">
              Physical Science starts in Grade 10.
            </p>
          )}
        </Field>

        <Field label="Preferred date" htmlFor="preferredDate" error={errors.preferredDate?.message}>
          <input id="preferredDate" type="date" className={FIELD} {...register('preferredDate')} />
        </Field>

        <Field label="Preferred time" htmlFor="preferredTime" error={errors.preferredTime?.message}>
          <input id="preferredTime" type="time" className={FIELD} {...register('preferredTime')} />
        </Field>

        <Field label="Phone (optional)" htmlFor="phone" error={errors.phone?.message}>
          <input id="phone" type="tel" autoComplete="tel" placeholder="0710836571" className={FIELD} {...register('phone')} />
        </Field>
      </div>

      {/* Lesson format */}
      <fieldset className="mt-6">
        <legend className="text-[14px] font-semibold text-brand-navy">Lesson format</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-brand-blue-100 px-4 text-[14px] text-brand-navy has-checked:border-brand-blue has-checked:bg-brand-blue-50"
            >
              <input type="radio" value={option.value} className="accent-brand-blue" {...register('mode')} />
              {option.label}
            </label>
          ))}
        </div>
        {errors.mode && <p className="mt-1.5 text-[13px] text-red-600">{errors.mode.message}</p>}
      </fieldset>

      <div className="mt-6">
        <Field label="What is your child finding difficult?" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={4}
            placeholder="For example: trigonometry and functions, and confidence before tests."
            className={`${FIELD} resize-y py-3`}
            {...register('notes')}
          />
        </Field>
      </div>

      {/* Honeypot */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="company">Company</label>
        <input id="company" tabIndex={-1} autoComplete="off" {...register('company')} />
      </div>

      {formError && (
        <p role="alert" className="mt-6 text-[14px] font-semibold text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-8 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Sending' : 'Request Free Trial'}
      </button>

      <p className="mt-3 text-[13px] text-brand-slate">
        The trial lesson is free and nothing is charged today.
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-brand-navy">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
