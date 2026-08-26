import { z } from 'zod';

import { DIFFICULTIES, QUESTION_TYPES } from '@/lib/assessment/constants';
import { objectId } from '@/validations/lesson-booking';

/** Assessment inputs (brief sections 4, 5 and 6). */

export const generateTestSchema = z.object({
  subjectId: objectId,
  gradeId: objectId,
  topic: z.string().trim().min(2, 'Enter a topic').max(120),
  difficulty: z.enum(DIFFICULTIES),
  questionCount: z
    .number()
    .int()
    .min(1, 'At least one question')
    .max(30, 'Thirty questions is the maximum'),
  totalMarks: z
    .number()
    .int()
    .min(1, 'Set the total marks')
    .max(300, 'That is too many marks'),
  durationMinutes: z
    .number()
    .int()
    .min(5, 'Give students at least five minutes')
    .max(240, 'Tests cannot run longer than four hours'),
  questionTypes: z
    .array(z.enum(QUESTION_TYPES))
    .min(1, 'Choose at least one question type'),
  title: z.string().trim().max(140).optional(),
});

export type GenerateTestInput = z.infer<typeof generateTestSchema>;

/** One question as the tutor edits it before publishing. */
export const questionDraftSchema = z
  .object({
    questionId: objectId.optional(),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(3, 'Write the question').max(2000),
    options: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(4),
          text: z.string().trim().min(1).max(500),
        })
      )
      .max(6)
      .default([]),
    correctAnswer: z.string().trim().min(1, 'Give the correct answer').max(2000),
    explanation: z.string().trim().max(2000).optional(),
    rubric: z
      .array(
        z.object({
          marks: z.number().min(0.5).max(20),
          criterion: z.string().trim().min(3).max(300),
        })
      )
      .max(20)
      .default([]),
    marks: z.number().int().min(1, 'A question is worth at least one mark').max(20),
  })
  .refine(
    (question) =>
      question.type !== 'multiple_choice' ||
      (question.options.length >= 2 &&
        question.options.some((option) => option.key === question.correctAnswer)),
    {
      message: 'Multiple choice needs at least two options, and the answer must be one of them',
      path: ['correctAnswer'],
    }
  )
  .refine(
    (question) => question.type !== 'numeric' || !Number.isNaN(Number(question.correctAnswer)),
    { message: 'A numeric question needs a number as its answer', path: ['correctAnswer'] }
  );

export const saveTestSchema = z.object({
  testId: objectId,
  title: z.string().trim().min(3, 'Give the test a title').max(140),
  description: z.string().trim().max(1000).optional(),
  topic: z.string().trim().max(120).optional(),
  durationMinutes: z.number().int().min(5).max(240),
  questions: z
    .array(questionDraftSchema)
    .min(1, 'A test needs at least one question')
    .max(50),
});

export type SaveTestInput = z.infer<typeof saveTestSchema>;

export const testIdSchema = z.object({ testId: objectId });

/** Answers as the student submits them. Marks are never accepted from here. */
export const submitAttemptSchema = z.object({
  attemptId: objectId,
  answers: z
    .array(
      z.object({
        questionId: objectId,
        response: z.string().max(10_000),
      })
    )
    .max(50),
});

export const adjustMarkSchema = z.object({
  attemptId: objectId,
  questionId: objectId,
  newMarks: z.number().min(0).max(100),
  reason: z.string().trim().min(3, 'Give a reason for the change').max(500),
});
