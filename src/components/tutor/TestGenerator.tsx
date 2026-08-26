'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

import { generateTestAction } from '@/actions/test.actions';
import {
  DIFFICULTIES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Difficulty,
  type QuestionType,
} from '@/lib/assessment/constants';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * The AI test builder (brief sections 3 and 4).
 *
 * Collects the tutor's specification and sends it to the server, which calls
 * the model, validates what comes back and saves it as a DRAFT. The tutor is
 * then taken to the review screen - nothing reaches a student from here.
 */
export default function TestGenerator({
  subjects,
  grades,
}: {
  subjects: { subjectId: string; name: string }[];
  grades: { gradeId: string; name: string }[];
}) {
  const router = useRouter();

  const [subjectId, setSubjectId] = useState(subjects[0]?.subjectId ?? '');
  const [gradeId, setGradeId] = useState(grades[0]?.gradeId ?? '');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [totalMarks, setTotalMarks] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [types, setTypes] = useState<QuestionType[]>(['multiple_choice', 'short_answer']);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleType = (type: QuestionType) => {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type]
    );
  };

  const generate = () => {
    setError(null);

    if (types.length === 0) {
      setError('Choose at least one question type.');
      return;
    }

    startTransition(async () => {
      const result = await generateTestAction({
        subjectId,
        gradeId,
        topic,
        difficulty,
        questionCount,
        totalMarks,
        durationMinutes,
        questionTypes: types,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Straight to review: the draft is not visible to students yet.
      router.push(`/tutor/tests/${result.data.testId}`);
    });
  };

  if (subjects.length === 0 || grades.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-6 text-center">
        <p className="text-[15px] font-semibold text-brand-navy">
          Subjects and grades are not set up yet
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-brand-slate">
          An administrator needs to add at least one subject and grade before
          tests can be created.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-brand-navy">
        <Sparkles className="size-5 text-brand-blue" aria-hidden="true" />
        Generate a test with AI
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-brand-slate">
        You will review and edit everything before students see it. Nothing is
        published automatically.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">Subject</span>
          <select
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className={`${FIELD_CLASS} mt-1`}
          >
            {subjects.map((subject) => (
              <option key={subject.subjectId} value={subject.subjectId}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">Grade</span>
          <select
            value={gradeId}
            onChange={(event) => setGradeId(event.target.value)}
            className={`${FIELD_CLASS} mt-1`}
          >
            {grades.map((grade) => (
              <option key={grade.gradeId} value={grade.gradeId}>
                {grade.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="block text-[13px] font-semibold text-brand-navy">Topic</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Quadratic equations"
            maxLength={120}
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>

        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">Difficulty</span>
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty)}
            className={`${FIELD_CLASS} mt-1 capitalize`}
          >
            {DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Number of questions
          </span>
          <input
            type="number"
            min={1}
            max={30}
            value={questionCount}
            onChange={(event) => setQuestionCount(Number(event.target.value))}
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>

        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">Total marks</span>
          <input
            type="number"
            min={1}
            max={300}
            value={totalMarks}
            onChange={(event) => setTotalMarks(Number(event.target.value))}
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
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-semibold text-brand-navy">
          Question types
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUESTION_TYPES.map((type) => {
            const selected = types.includes(type);

            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleType(type)}
                className={`min-h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                  selected
                    ? 'border-brand-blue bg-brand-blue text-white'
                    : 'border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
                }`}
              >
                {QUESTION_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-brand-slate">
          Multiple choice, true/false and numeric answers are marked
          automatically. Short answers and written explanations are marked
          against a rubric.
        </p>
      </fieldset>

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-5">
        <button
          type="button"
          onClick={generate}
          disabled={pending || topic.trim().length < 2}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Writing your test&hellip;
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden="true" />
              Generate with AI
            </>
          )}
        </button>

        {pending ? (
          <p className="mt-2 text-[13px] text-brand-slate">
            This usually takes ten to twenty seconds.
          </p>
        ) : null}
      </div>
    </div>
  );
}
