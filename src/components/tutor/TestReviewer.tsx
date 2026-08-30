'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus, Send, Trash2 } from 'lucide-react';

import { publishTestAction, saveTestAction } from '@/actions/test.actions';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  isAutoMarked,
  type QuestionType,
} from '@/lib/assessment/constants';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * Review and edit a draft before publishing (brief section 3).
 *
 * The tutor can change every part of what the AI produced - the wording, the
 * options, the answer, the marks and the rubric - because the AI drafts and
 * the tutor decides. Publishing is a separate, deliberate action.
 */

export type QuestionDraft = {
  questionId?: string;
  type: QuestionType;
  prompt: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  rubric: { marks: number; criterion: string }[];
  marks: number;
};

const BLANK_QUESTION: QuestionDraft = {
  type: 'multiple_choice',
  prompt: '',
  options: [
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ],
  correctAnswer: 'A',
  explanation: '',
  rubric: [],
  marks: 1,
};

export default function TestReviewer({
  testId,
  initialTitle,
  initialDescription,
  initialTopic,
  initialDuration,
  initialAvailableFrom,
  initialAvailableUntil,
  initialQuestions,
  isDraft,
}: {
  testId: string;
  initialTitle: string;
  initialDescription: string;
  initialTopic: string;
  initialDuration: number;
  /** "YYYY-MM-DDTHH:mm" in South African time, or empty. */
  initialAvailableFrom: string;
  initialAvailableUntil: string;
  initialQuestions: QuestionDraft[];
  isDraft: boolean;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [topic, setTopic] = useState(initialTopic);
  const [duration, setDuration] = useState(initialDuration);
  const [availableFrom, setAvailableFrom] = useState(initialAvailableFrom);
  const [availableUntil, setAvailableUntil] = useState(initialAvailableUntil);
  const [questions, setQuestions] = useState<QuestionDraft[]>(initialQuestions);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const totalMarks = questions.reduce((sum, question) => sum + (question.marks || 0), 0);

  const patch = (index: number, changes: Partial<QuestionDraft>) => {
    setSaved(false);
    setError(null);
    setQuestions((current) =>
      current.map((question, position) =>
        position === index ? { ...question, ...changes } : question
      )
    );
  };

  const save = (then?: () => void) => {
    setError(null);

    startTransition(async () => {
      const result = await saveTestAction({
        testId,
        title,
        description: description || undefined,
        topic: topic || undefined,
        durationMinutes: duration,
        availableFrom,
        availableUntil,
        questions: questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          options: question.type === 'multiple_choice' ? question.options : [],
          correctAnswer: question.correctAnswer,
          explanation: question.explanation || undefined,
          rubric: isAutoMarked(question.type) ? [] : question.rubric,
          marks: question.marks,
        })),
      });

      if (!result.ok) {
        setError(
          result.issues?.length
            ? `${result.error} ${result.issues[0].message}`
            : result.error
        );
        return;
      }

      setSaved(true);
      then?.();
    });
  };

  const publish = () => {
    // Save first, so what goes live is exactly what is on screen.
    save(() => {
      startTransition(async () => {
        const result = await publishTestAction({ testId });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        router.push('/tutor/tests');
      });
    });
  };

  if (!isDraft) {
    return (
      <div className="rounded-2xl bg-brand-blue-50/60 p-5">
        <p className="text-[15px] font-semibold text-brand-navy">
          This test has been published
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-brand-slate">
          Published tests cannot be edited, because students may already have
          sat them and changing the questions would invalidate their marks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="block text-[13px] font-semibold text-brand-navy">Title</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSaved(false);
              }}
              maxLength={140}
              className={`${FIELD_CLASS} mt-1`}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="block text-[13px] font-semibold text-brand-navy">
              Instructions for students
            </span>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSaved(false);
              }}
              maxLength={1000}
              className={`${FIELD_CLASS} mt-1 py-2`}
            />
          </label>

          <label className="block">
            <span className="block text-[13px] font-semibold text-brand-navy">Topic</span>
            <input
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setSaved(false);
              }}
              maxLength={120}
              className={`${FIELD_CLASS} mt-1`}
            />
          </label>

          <label className="block">
            <span className="block text-[13px] font-semibold text-brand-navy">
              Time limit (minutes)
            </span>
            <input
              type="number"
              min={5}
              max={240}
              value={duration}
              onChange={(event) => {
                setDuration(Number(event.target.value));
                setSaved(false);
              }}
              className={`${FIELD_CLASS} mt-1`}
            />
          </label>
        </div>

        {/* The sitting. Both optional: a test with no window opens the moment
            it is published and never closes, which is the old behaviour and
            still the right default for homework-style practice. */}
        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold text-brand-navy">
            Scheduled sitting <span className="font-normal text-brand-slate">(optional)</span>
          </legend>
          <p className="mt-1 text-[13px] text-brand-slate">
            South African time. Leave both empty for a test students can take
            whenever they like. Setting an opening time puts it on the timetable.
          </p>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[13px] font-semibold text-brand-navy">Opens</span>
              <input
                type="datetime-local"
                value={availableFrom}
                onChange={(event) => {
                  setAvailableFrom(event.target.value);
                  setSaved(false);
                }}
                className={`${FIELD_CLASS} mt-1`}
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-semibold text-brand-navy">Closes</span>
              <input
                type="datetime-local"
                value={availableUntil}
                min={availableFrom || undefined}
                onChange={(event) => {
                  setAvailableUntil(event.target.value);
                  setSaved(false);
                }}
                className={`${FIELD_CLASS} mt-1`}
              />
            </label>
          </div>
        </fieldset>

        <p className="mt-4 text-[14px] font-semibold text-brand-navy">
          {questions.length} question{questions.length === 1 ? '' : 's'} ·{' '}
          {totalMarks} mark{totalMarks === 1 ? '' : 's'} total
        </p>
      </div>

      <ol className="space-y-4">
        {questions.map((question, index) => (
          <li key={index}>
            <QuestionEditor
              index={index}
              question={question}
              onChange={(changes) => patch(index, changes)}
              onRemove={() => {
                setSaved(false);
                setQuestions((current) => current.filter((_, position) => position !== index));
              }}
            />
          </li>
        ))}
      </ol>

      {error ? <ErrorNote message={error} /> : null}

      {saved ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-[14px] font-medium text-green-800"
        >
          <Check className="size-4" aria-hidden="true" />
          Draft saved.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setQuestions((current) => [...current, { ...BLANK_QUESTION }]);
          }}
          className={SECONDARY_BUTTON}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a question
        </button>

        <button
          type="button"
          onClick={() => save()}
          disabled={pending}
          className={SECONDARY_BUTTON}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save draft
        </button>

        <button
          type="button"
          onClick={publish}
          disabled={pending || questions.length === 0}
          className={PRIMARY_BUTTON}
        >
          <Send className="size-4" aria-hidden="true" />
          Publish to students
        </button>
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  question,
  onChange,
  onRemove,
}: {
  index: number;
  question: QuestionDraft;
  onChange: (changes: Partial<QuestionDraft>) => void;
  onRemove: () => void;
}) {
  const autoMarked = isAutoMarked(question.type);

  return (
    <div className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold text-brand-navy">Question {index + 1}</h3>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Type for question ${index + 1}`}
            value={question.type}
            onChange={(event) => {
              const type = event.target.value as QuestionType;

              onChange({
                type,
                // Switching type invalidates the old answer shape, so reset it
                // rather than leaving an answer that can never be matched.
                correctAnswer: type === 'true_false' ? 'true' : '',
                options:
                  type === 'multiple_choice' && question.options.length === 0
                    ? BLANK_QUESTION.options
                    : question.options,
                rubric: isAutoMarked(type) ? [] : question.rubric,
              });
            }}
            className="min-h-11 rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-3 text-[14px] text-brand-navy"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-[13px] text-brand-navy">
            Marks
            <input
              type="number"
              min={1}
              max={20}
              value={question.marks}
              onChange={(event) => onChange({ marks: Number(event.target.value) })}
              className="min-h-11 w-16 rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-2 text-center text-[14px] text-brand-navy"
            />
          </label>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove question ${index + 1}`}
            className="rounded-full p-2 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="block text-[13px] font-semibold text-brand-navy">Question</span>
        <textarea
          rows={2}
          value={question.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          maxLength={2000}
          className={`${FIELD_CLASS} mt-1 py-2`}
        />
      </label>

      {question.type === 'multiple_choice' ? (
        <fieldset className="mt-3">
          <legend className="text-[13px] font-semibold text-brand-navy">
            Options — select the correct one
          </legend>
          <div className="mt-2 space-y-2">
            {question.options.map((option, optionIndex) => (
              <div key={option.key} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={question.correctAnswer === option.key}
                  onChange={() => onChange({ correctAnswer: option.key })}
                  aria-label={`Option ${option.key} is correct`}
                  className="size-4 text-brand-blue focus:ring-brand-blue"
                />
                <span className="w-5 text-[14px] font-bold text-brand-slate">
                  {option.key}
                </span>
                <input
                  value={option.text}
                  onChange={(event) =>
                    onChange({
                      options: question.options.map((entry, position) =>
                        position === optionIndex
                          ? { ...entry, text: event.target.value }
                          : entry
                      ),
                    })
                  }
                  maxLength={500}
                  className={FIELD_CLASS}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="mt-3 block">
          <span className="block text-[13px] font-semibold text-brand-navy">
            {autoMarked ? 'Correct answer' : 'Model answer'}
          </span>
          {question.type === 'true_false' ? (
            <select
              value={question.correctAnswer || 'true'}
              onChange={(event) => onChange({ correctAnswer: event.target.value })}
              className={`${FIELD_CLASS} mt-1`}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : autoMarked ? (
            <input
              value={question.correctAnswer}
              onChange={(event) => onChange({ correctAnswer: event.target.value })}
              placeholder="12.5"
              className={`${FIELD_CLASS} mt-1`}
            />
          ) : (
            <textarea
              rows={3}
              value={question.correctAnswer}
              onChange={(event) => onChange({ correctAnswer: event.target.value })}
              maxLength={2000}
              className={`${FIELD_CLASS} mt-1 py-2`}
            />
          )}
        </label>
      )}

      {!autoMarked ? (
        <RubricEditor
          rubric={question.rubric}
          marks={question.marks}
          onChange={(rubric) => onChange({ rubric })}
        />
      ) : null}

      <label className="mt-3 block">
        <span className="block text-[13px] font-semibold text-brand-navy">
          Explanation shown after marking
        </span>
        <textarea
          rows={2}
          value={question.explanation}
          onChange={(event) => onChange({ explanation: event.target.value })}
          maxLength={2000}
          className={`${FIELD_CLASS} mt-1 py-2`}
        />
      </label>
    </div>
  );
}

/**
 * The marking rubric for a written question (brief section 8).
 *
 * The AI marks against exactly what is entered here, so it is editable rather
 * than hidden - a tutor who disagrees with how the marks were split can change
 * it before anyone sits the test.
 */
function RubricEditor({
  rubric,
  marks,
  onChange,
}: {
  rubric: { marks: number; criterion: string }[];
  marks: number;
  onChange: (rubric: { marks: number; criterion: string }[]) => void;
}) {
  const allocated = rubric.reduce((sum, entry) => sum + entry.marks, 0);

  return (
    <fieldset className="mt-3 rounded-xl bg-brand-blue-50/50 p-3">
      <legend className="px-1 text-[13px] font-semibold text-brand-navy">
        Marking rubric
      </legend>

      <div className="space-y-2">
        {rubric.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="number"
              min={0.5}
              step={0.5}
              max={20}
              value={entry.marks}
              aria-label="Marks for this criterion"
              onChange={(event) =>
                onChange(
                  rubric.map((row, position) =>
                    position === index ? { ...row, marks: Number(event.target.value) } : row
                  )
                )
              }
              className="min-h-11 w-16 rounded-xl border border-brand-blue-100 bg-white px-2 text-center text-[14px] text-brand-navy"
            />
            <input
              value={entry.criterion}
              aria-label="What earns these marks"
              placeholder="States the relationship correctly"
              onChange={(event) =>
                onChange(
                  rubric.map((row, position) =>
                    position === index ? { ...row, criterion: event.target.value } : row
                  )
                )
              }
              maxLength={300}
              className="min-h-11 flex-1 rounded-xl border border-brand-blue-100 bg-white px-3 text-[14px] text-brand-navy"
            />
            <button
              type="button"
              onClick={() => onChange(rubric.filter((_, position) => position !== index))}
              aria-label="Remove this criterion"
              className="rounded-full p-2 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange([...rubric, { marks: 1, criterion: '' }])}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a criterion
        </button>

        <p
          className={`text-[13px] font-semibold ${
            allocated === marks ? 'text-brand-slate' : 'text-brand-amber-text'
          }`}
        >
          {allocated} of {marks} marks allocated
        </p>
      </div>
    </fieldset>
  );
}
