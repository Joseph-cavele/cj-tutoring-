'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

import { createBookingAction } from '@/actions/booking.actions';
import { startBookingCheckoutAction } from '@/actions/payment.actions';
import { ErrorNote, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';
import {
  EMPTY_DRAFT,
  WIZARD_STEPS,
  formatBookingDate,
  type BookableStudent,
  type BookableSubject,
  type BookableTutor,
  type BookingDraft,
  type WizardStepKey,
} from '@/types/booking';
import StepConfirm from './StepConfirm';
import StepIndicator from './StepIndicator';
import StepSchedule from './StepSchedule';
import StepStudent from './StepStudent';
import StepSubject from './StepSubject';
import StepTutor from './StepTutor';

/**
 * The five-step booking flow (brief sections 3, 4 and 16).
 *
 * Holds only the draft and which step is showing. Every decision that matters
 * - which tutors teach a subject, which times are free, what the lesson costs,
 * whether the booking may be made at all - is answered by the server. This
 * component cannot approve a booking, only ask for one.
 */
export default function BookingWizard({
  students,
  subjects,
  role,
  minDate,
}: {
  students: BookableStudent[];
  subjects: BookableSubject[];
  role: string;
  /** Today in South Africa, from the server. */
  minDate: string;
}) {
  const [step, setStep] = useState<WizardStepKey>('student');
  // A student has one option, so it is chosen for them rather than making
  // them tap their own name.
  const [draft, setDraft] = useState<BookingDraft>({
    ...EMPTY_DRAFT,
    studentId: students.length === 1 ? students[0].studentId : '',
  });

  // Cached against the subject it answers, so a list fetched for a previous
  // subject is never shown for the current one - and nothing has to be
  // cleared inside an effect to make that true.
  const [tutorCache, setTutorCache] = useState<{
    subjectId: string;
    tutors: BookableTutor[];
  }>({ subjectId: '', tutors: [] });
  const [tutorsLoading, setTutorsLoading] = useState(false);
  const [tutorsError, setTutorsError] = useState<string | null>(null);

  // Memoised so the empty-array branch does not produce a new reference on
  // every render, which would invalidate the useMemo below each time.
  const tutors = useMemo(
    () =>
      tutorCache.subjectId && tutorCache.subjectId === draft.subjectId
        ? tutorCache.tutors
        : [],
    [tutorCache, draft.subjectId]
  );

  // Children added mid-flow. The page's server-rendered list cannot include
  // them until it revalidates, so they are held here and merged for display.
  const [addedStudents, setAddedStudents] = useState<BookableStudent[]>([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ bookingId: string } | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [isSubmitting, startSubmit] = useTransition();

  const update = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setFormError(null);
  }, []);

  // Tutors depend on the subject, so the list reloads whenever it changes.
  useEffect(() => {
    if (!draft.subjectId) return;

    const controller = new AbortController();

    async function loadTutors() {
      setTutorsLoading(true);
      setTutorsError(null);

      try {
        const response = await fetch(
          `/api/booking/tutors?subjectId=${encodeURIComponent(draft.subjectId)}`,
          { signal: controller.signal }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setTutorsError(data.error ?? 'Could not load tutors');
          return;
        }

        setTutorCache({ subjectId: draft.subjectId, tutors: data.tutors ?? [] });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setTutorsError('No connection. Please try again.');
      } finally {
        setTutorsLoading(false);
      }
    }

    loadTutors();

    return () => controller.abort();
  }, [draft.subjectId]);

  const allStudents = useMemo(() => {
    const known = new Set(students.map((entry) => entry.studentId));
    return [...students, ...addedStudents.filter((entry) => !known.has(entry.studentId))];
  }, [students, addedStudents]);

  const selectedStudent = useMemo(
    () => allStudents.find((entry) => entry.studentId === draft.studentId) ?? null,
    [allStudents, draft.studentId]
  );

  const selectedSubject = useMemo(
    () => subjects.find((entry) => entry.subjectId === draft.subjectId) ?? null,
    [subjects, draft.subjectId]
  );

  const selectedTutor = useMemo(
    () => tutors.find((entry) => entry.tutorId === draft.tutorId) ?? null,
    [tutors, draft.tutorId]
  );

  /** A step may only be left once it has what the next step needs. */
  const canContinue = (): boolean => {
    if (step === 'student') return Boolean(draft.studentId);
    if (step === 'subject') return Boolean(draft.subjectId);
    if (step === 'tutor') return Boolean(draft.tutorId);
    if (step === 'schedule') return Boolean(draft.date && draft.startTime);
    return true;
  };

  const stepIndex = WIZARD_STEPS.findIndex((entry) => entry.key === step);

  const goBack = () => {
    setFormError(null);
    if (stepIndex > 0) setStep(WIZARD_STEPS[stepIndex - 1].key);
  };

  const goNext = () => {
    setFormError(null);
    if (stepIndex < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[stepIndex + 1].key);
  };

  const submit = () => {
    setFormError(null);

    startSubmit(async () => {
      const result = await createBookingAction({
        // A student's id is ignored by the server, which uses their session
        // instead; it is sent only so a parent or admin can name the child.
        studentId: draft.studentId || undefined,
        subjectId: draft.subjectId,
        tutorId: draft.tutorId,
        date: draft.date,
        startTime: draft.startTime,
        durationMinutes: draft.durationMinutes,
        teachingMode: draft.teachingMode,
        notes: draft.notes || undefined,
      });

      if (!result.ok) {
        setFormError(result.error);
        // A time that was taken while the form was open is a scheduling
        // problem, so send the user back to the step that can fix it.
        if (/booked|passed|available|outside/i.test(result.error)) setStep('schedule');
        return;
      }

      // The slot is now held. If the platform takes payment, the lesson does
      // not reach the tutor until it is settled, so go straight to checkout.
      if (result.data.requiresPayment) {
        const checkout = await startBookingCheckoutAction(result.data.bookingId);

        if (checkout.ok) {
          setRedirecting(true);
          window.location.href = checkout.data.redirectUrl;
          return;
        }

        // The booking still exists and still holds the slot, so say so rather
        // than implying the whole request was lost.
        setFormError(
          `${checkout.error} Your booking is held under "awaiting payment" on your dashboard, where you can try again.`
        );
        return;
      }

      setConfirmed({ bookingId: result.data.bookingId });
    });
  };

  const reset = () => {
    setConfirmed(null);
    setFormError(null);
    setStep('student');
    setDraft({
      ...EMPTY_DRAFT,
      studentId: students.length === 1 ? students[0].studentId : '',
    });
  };

  if (confirmed) {
    return (
      <BookingConfirmation
        draft={draft}
        tutorName={selectedTutor?.name ?? 'your tutor'}
        role={role}
        onReset={reset}
      />
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8">
      <StepIndicator current={step} />

      <div className="mt-6">
        <h2 className="text-xl font-extrabold text-brand-navy">
          {stepTitle(step, role)}
        </h2>

        <div className="mt-4">
          {step === 'student' ? (
            <StepStudent
              students={allStudents}
              selectedId={draft.studentId}
              role={role}
              onSelect={(studentId) => update({ studentId })}
              onChildAdded={(studentId, name) => {
                setAddedStudents((current) => [...current, { studentId, name }]);
                // Selected straight away: a parent who just added a child
                // almost certainly wants to book for them.
                update({ studentId });
              }}
            />
          ) : null}

          {step === 'subject' ? (
            <StepSubject
              subjects={subjects}
              selectedId={draft.subjectId}
              onSelect={(subjectId) =>
                // Changing the subject invalidates the tutor beneath it.
                update({ subjectId, tutorId: '', startTime: '' })
              }
            />
          ) : null}

          {step === 'tutor' ? (
            <StepTutor
              tutors={tutors}
              loading={tutorsLoading}
              error={tutorsError}
              selectedId={draft.tutorId}
              onSelect={(tutorId) => {
                const tutor = tutors.find((entry) => entry.tutorId === tutorId);
                update({
                  tutorId,
                  startTime: '',
                  // Start from a format this tutor actually offers.
                  teachingMode: tutor?.teachingModes?.[0] ?? 'online',
                });
              }}
            />
          ) : null}

          {step === 'schedule' ? (
            <StepSchedule
              draft={draft}
              tutor={selectedTutor}
              minDate={minDate}
              onChange={update}
            />
          ) : null}

          {step === 'confirm' ? (
            <StepConfirm
              draft={draft}
              student={selectedStudent}
              subject={selectedSubject}
              tutor={selectedTutor}
            />
          ) : null}
        </div>

        {formError ? (
          <div className="mt-5">
            <ErrorNote message={formError} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || isSubmitting}
            className={SECONDARY_BUTTON}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>

          {step === 'confirm' ? (
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting || redirecting}
              className={PRIMARY_BUTTON}
            >
              {redirecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Taking you to payment&hellip;
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sending request&hellip;
                </>
              ) : (
                'Confirm booking'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue()}
              className={PRIMARY_BUTTON}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function stepTitle(step: WizardStepKey, role: string): string {
  if (step === 'student') return role === 'parent' ? 'Who is this lesson for?' : 'Your details';
  if (step === 'subject') return 'Which subject?';
  if (step === 'tutor') return 'Choose a tutor';
  if (step === 'schedule') return 'Pick a date and time';
  return 'Check the details';
}

/** Success state (brief section 16). */
function BookingConfirmation({
  draft,
  tutorName,
  role,
  onReset,
}: {
  draft: BookingDraft;
  tutorName: string;
  role: string;
  onReset: () => void;
}) {
  const dashboard = role === 'parent' ? '/parent/dashboard' : '/student/dashboard';

  return (
    <div
      role="status"
      className="rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-soft)]"
    >
      <CheckCircle2 className="mx-auto size-12 text-brand-blue" aria-hidden="true" />

      <h2 className="mt-4 text-xl font-bold text-brand-navy">
        Booking request submitted successfully
      </h2>

      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-brand-slate">
        {tutorName} will review your request for{' '}
        <span className="font-semibold text-brand-navy">
          {formatBookingDate(draft.date)} at {draft.startTime}
        </span>
        . You will see the status change on your dashboard as soon as they respond.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={dashboard} className={PRIMARY_BUTTON}>
          Go to my dashboard
        </Link>
        {/* A button, not a link: navigating to the same route would leave
            this confirmation mounted with the old draft still in state. */}
        <button type="button" onClick={onReset} className={SECONDARY_BUTTON}>
          Book another lesson
        </button>
      </div>
    </div>
  );
}
