'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, Loader2, Send } from 'lucide-react';

import {
  autoSubmitAction,
  saveProgressAction,
  submitAttemptAction,
} from '@/actions/test.actions';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/assessment/constants';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Sitting a test (brief section 6).
 *
 * The paper arrives without any answer key - the server does not select those
 * fields for a student - so there is nothing in this component, or in the page
 * source, that reveals a correct answer.
 *
 * The countdown is a display of the server's deadline, not the authority on
 * it: when it reaches zero the browser asks the server to submit, and the
 * server checks its own stored `expiresAt` before doing so.
 */

export type PlayerQuestion = {
  questionId: string;
  type: QuestionType;
  prompt: string;
  options: { key: string; text: string }[];
  marks: number;
};

const AUTOSAVE_MS = 15_000;

export default function TestPlayer({
  attemptId,
  title,
  description,
  totalMarks,
  expiresAt,
  questions,
  savedAnswers,
}: {
  attemptId: string;
  title: string;
  description: string;
  totalMarks: number;
  expiresAt: string | null;
  questions: PlayerQuestion[];
  savedAnswers: { questionId: string; response: string }[];
}) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(savedAnswers.map((answer) => [answer.questionId, answer.response]))
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // Kept in a ref so the autosave and timer effects can read the latest
  // answers without re-subscribing on every keystroke. Written in an effect,
  // never during render.
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submitted = useRef(false);

  const asPayload = useCallback(
    () =>
      questions.map((question) => ({
        questionId: question.questionId,
        response: answersRef.current[question.questionId] ?? '',
      })),
    [questions]
  );

  /* Countdown. Recomputed from the deadline each tick rather than decremented,
     so a suspended tab does not end up with a timer that is minutes fast. */
  useEffect(() => {
    if (!expiresAt) return;

    const deadline = new Date(expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0 && !submitted.current) {
        submitted.current = true;

        // The server re-checks its own deadline; this is only the nudge.
        void autoSubmitAction(attemptId).then(() => {
          router.replace(`/student/results/${attemptId}`);
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, attemptId, router]);

  /* Periodic autosave, so a dropped connection or a closed tab does not lose
     the student's work (brief section 6). */
  useEffect(() => {
    const interval = setInterval(() => {
      if (submitted.current) return;
      void saveProgressAction({ attemptId, answers: asPayload() });
    }, AUTOSAVE_MS);

    return () => clearInterval(interval);
  }, [attemptId, asPayload]);

  /* Warn before an accidental navigation away mid-test. */
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (submitted.current) return;
      event.preventDefault();
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const setAnswer = (questionId: string, response: string) => {
    setAnswers((current) => ({ ...current, [questionId]: response }));
  };

  const submit = () => {
    setError(null);

    startTransition(async () => {
      submitted.current = true;

      const result = await submitAttemptAction({ attemptId, answers: asPayload() });

      if (!result.ok) {
        submitted.current = false;
        setError(result.error);
        setConfirming(false);
        return;
      }

      router.replace(`/student/results/${attemptId}`);
    });
  };

  const answeredCount = questions.filter((question) =>
    (answers[question.questionId] ?? '').trim()
  ).length;

  const unanswered = questions.length - answeredCount;
  const lowTime = secondsLeft !== null && secondsLeft <= 120;

  return (
    <div className="space-y-5">
      {/* Sticky so the clock and progress stay visible while scrolling on a phone. */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-brand-blue-100 bg-brand-cream/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-brand-navy">
            {answeredCount} of {questions.length} answered
          </p>

          {secondsLeft !== null ? (
            <p
              role="timer"
              aria-live={lowTime ? 'assertive' : 'off'}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-bold tabular-nums ${
                lowTime ? 'bg-red-100 text-red-700' : 'bg-brand-blue-50 text-brand-navy'
              }`}
            >
              <Clock className="size-4" aria-hidden="true" />
              {formatClock(secondsLeft)}
              <span className="sr-only">remaining</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h1 className="text-2xl font-extrabold text-brand-navy">{title}</h1>
        {description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-brand-slate">{description}</p>
        ) : null}
        <p className="mt-2 text-[14px] text-brand-slate">{totalMarks} marks in total.</p>
      </div>

      <ol className="space-y-4">
        {questions.map((question, index) => (
          <li
            key={question.questionId}
            className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-bold text-brand-navy">
                Question {index + 1}
              </h2>
              <p className="text-[13px] text-brand-slate">
                {QUESTION_TYPE_LABELS[question.type]} · {question.marks} mark
                {question.marks === 1 ? '' : 's'}
              </p>
            </div>

            <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-brand-navy">
              {question.prompt}
            </p>

            <div className="mt-3">
              <AnswerInput
                question={question}
                value={answers[question.questionId] ?? ''}
                onChange={(value) => setAnswer(question.questionId, value)}
              />
            </div>
          </li>
        ))}
      </ol>

      {error ? <ErrorNote message={error} /> : null}

      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
        {confirming ? (
          <div>
            <p className="flex items-start gap-2 text-[15px] font-medium text-brand-navy">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-brand-amber"
                aria-hidden="true"
              />
              {unanswered > 0
                ? `You have ${unanswered} unanswered question${
                    unanswered === 1 ? '' : 's'
                  }. Submit anyway?`
                : 'Submit your test? You cannot change your answers afterwards.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className={PRIMARY_BUTTON}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Marking&hellip;
                  </>
                ) : (
                  'Yes, submit'
                )}
              </button>

              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-brand-blue-100 px-6 text-[15px] font-semibold text-brand-navy hover:bg-brand-blue-50"
              >
                Keep working
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${PRIMARY_BUTTON} w-full sm:w-auto`}
          >
            <Send className="size-4" aria-hidden="true" />
            Submit test
          </button>
        )}
      </div>
    </div>
  );
}

function AnswerInput({
  question,
  value,
  onChange,
}: {
  question: PlayerQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === 'multiple_choice') {
    return (
      <fieldset>
        <legend className="sr-only">Choose an answer</legend>
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option.key}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3 transition-colors ${
                value === option.key
                  ? 'border-brand-blue bg-brand-blue-50'
                  : 'border-brand-blue-100 hover:bg-brand-blue-50/50'
              }`}
            >
              <input
                type="radio"
                name={question.questionId}
                value={option.key}
                checked={value === option.key}
                onChange={() => onChange(option.key)}
                className="size-4 shrink-0 text-brand-blue focus:ring-brand-blue"
              />
              <span className="text-[14px] font-bold text-brand-slate">{option.key}</span>
              <span className="text-[15px] text-brand-navy">{option.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === 'true_false') {
    return (
      <fieldset>
        <legend className="sr-only">True or false</legend>
        <div className="flex gap-2">
          {['true', 'false'].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              onClick={() => onChange(option)}
              className={`min-h-12 flex-1 rounded-xl border-[1.5px] text-[15px] font-semibold capitalize transition-colors ${
                value === option
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === 'numeric') {
    return (
      <input
        // inputMode rather than type=number: students type units and commas,
        // and a number input silently discards them.
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Your answer"
        className={FIELD_CLASS}
      />
    );
  }

  return (
    <textarea
      rows={question.type === 'essay' ? 8 : 4}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={10_000}
      placeholder="Show your working and explain your reasoning."
      className={`${FIELD_CLASS} py-3`}
    />
  );
}

/** Seconds to "MM:SS", or "H:MM:SS" for anything over an hour. */
function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
