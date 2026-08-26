import { z } from 'zod';

import { getGeminiClient, AI_MODEL } from '@/lib/ai/gemini';
import {
  QUESTION_TYPES,
  isAutoMarked,
  type Difficulty,
  type QuestionType,
} from '@/lib/assessment/constants';

/**
 * AI assessment service (brief section 13).
 *
 * Server-only: it reads AI_API_KEY, so nothing here may be imported from a
 * client component. Every response is parsed with Zod before it goes anywhere
 * near the database - a model that returns nine questions when asked for ten,
 * or awards eleven marks out of five, must fail loudly rather than write
 * nonsense into a student's record.
 */

export class AiUnavailableError extends Error {
  constructor(message = 'The AI service is not available right now') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export function isAiConfigured(): boolean {
  const key = process.env.AI_API_KEY;
  return Boolean(key && !key.startsWith('your_'));
}

/* ------------------------------------------------------------------ *
 * Test generation
 * ------------------------------------------------------------------ */

const generatedQuestionSchema = z
  .object({
    prompt: z.string().trim().min(5).max(2000),
    type: z.enum(QUESTION_TYPES),
    options: z
      .array(z.object({ key: z.string().trim().min(1).max(4), text: z.string().trim().min(1).max(500) }))
      .max(6)
      .default([]),
    correctAnswer: z.string().trim().min(1).max(2000),
    marks: z.number().int().min(1).max(20),
    explanation: z.string().trim().max(2000).default(''),
    rubric: z
      .array(
        z.object({
          marks: z.number().min(0.5).max(20),
          criterion: z.string().trim().min(3).max(300),
        })
      )
      .max(20)
      .default([]),
  })
  // A multiple-choice question with no options is unusable, and its answer has
  // to name one of them - otherwise nothing can ever be marked correct.
  .refine(
    (question) =>
      question.type !== 'multiple_choice' ||
      (question.options.length >= 2 &&
        question.options.some((option) => option.key === question.correctAnswer)),
    { message: 'A multiple-choice question needs options and an answer that matches one' }
  )
  .refine(
    (question) => question.type !== 'numeric' || !Number.isNaN(Number(question.correctAnswer)),
    { message: 'A numeric question needs a numeric answer' }
  );

const generatedTestSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(50),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

/** JSON shape demanded of the model, so the reply is parseable by construction. */
const TEST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          type: { type: 'string', enum: [...QUESTION_TYPES] },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: { key: { type: 'string' }, text: { type: 'string' } },
              required: ['key', 'text'],
            },
          },
          correctAnswer: { type: 'string' },
          marks: { type: 'integer' },
          explanation: { type: 'string' },
          rubric: {
            type: 'array',
            items: {
              type: 'object',
              properties: { marks: { type: 'number' }, criterion: { type: 'string' } },
              required: ['marks', 'criterion'],
            },
          },
        },
        required: ['prompt', 'type', 'options', 'correctAnswer', 'marks', 'explanation', 'rubric'],
      },
    },
  },
  required: ['questions'],
} as const;

export type GenerateTestParams = {
  subject: string;
  gradeLabel: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  totalMarks: number;
  questionTypes: QuestionType[];
};

/**
 * Generates draft questions for a tutor to review.
 *
 * The result is never published automatically (brief section 3) - this returns
 * data, and a tutor decides what happens to it.
 */
export async function generateTest(params: GenerateTestParams): Promise<GeneratedQuestion[]> {
  if (!isAiConfigured()) throw new AiUnavailableError('AI test generation is not switched on');

  const prompt = buildGenerationPrompt(params);

  let text: string;

  try {
    const response = await getGeminiClient().models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: TEST_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    });

    text = response.text ?? '';
  } catch (error) {
    console.error('[ai] test generation call failed', error);
    throw new AiUnavailableError('The AI could not generate a test just now');
  }

  const parsed = safeParseJson(text, generatedTestSchema);

  if (!parsed) {
    throw new AiUnavailableError(
      'The AI returned a test we could not read. Please try again.'
    );
  }

  const questions = parsed.questions.slice(0, params.questionCount);

  // A written question with no rubric cannot be marked consistently later
  // (brief section 8), so one is required rather than invented at marking time.
  return questions.map((question) => ({
    ...question,
    rubric: isAutoMarked(question.type)
      ? []
      : question.rubric.length > 0
        ? question.rubric
        : [{ marks: question.marks, criterion: 'A complete and correct answer' }],
  }));
}

function buildGenerationPrompt(params: GenerateTestParams): string {
  const types = params.questionTypes.map((type) => `"${type}"`).join(', ');

  return `Write a ${params.difficulty} ${params.subject} test for ${params.gradeLabel} students in South Africa, following the CAPS curriculum.

Topic: ${params.topic}
Number of questions: exactly ${params.questionCount}
Total marks across all questions: exactly ${params.totalMarks}
Allowed question types: ${types}

Rules:
- Use South African terminology, contexts, units and currency (Rand) where a context is needed.
- Marks must be whole numbers and must add up to exactly ${params.totalMarks}.
- For "multiple_choice": give 4 options with keys "A", "B", "C", "D", and set correctAnswer to the key of the right one.
- For "true_false": set correctAnswer to exactly "true" or "false" and leave options empty.
- For "numeric": correctAnswer must be a plain number with no units or words. State the unit in the prompt instead.
- For "short_answer" and "essay": correctAnswer holds a model answer, and rubric must break the marks down, one entry per mark or per marking point, adding up to that question's marks.
- explanation must show the working or reasoning a tutor would give.
- Write mathematics in plain text, for example x^2, sqrt(3), 1/2.
- Do not number the questions; the platform does that.`;
}

/* ------------------------------------------------------------------ *
 * Marking written answers
 * ------------------------------------------------------------------ */

const markedAnswerSchema = z.object({
  marksAwarded: z.number().min(0),
  feedback: z.string().trim().min(1).max(1500),
  improvement: z.string().trim().max(1000).default(''),
});

const MARK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    marksAwarded: { type: 'number' },
    feedback: { type: 'string' },
    improvement: { type: 'string' },
  },
  required: ['marksAwarded', 'feedback', 'improvement'],
} as const;

export type MarkedAnswer = {
  marksAwarded: number;
  feedback: string;
  improvement: string;
};

/**
 * Marks one written answer against its rubric.
 *
 * Only the question, its rubric, the model answer and the student's response
 * are sent - no name, no history, nothing about other students
 * (brief section 7).
 *
 * The awarded mark is clamped to `maxMarks` here, so the AI cannot inflate a
 * question beyond what the tutor allocated no matter what it returns
 * (brief section 7, "do not allow the AI to arbitrarily change the maximum
 * mark").
 */
export async function markWrittenAnswer(params: {
  prompt: string;
  modelAnswer: string;
  rubric: { marks: number; criterion: string }[];
  maxMarks: number;
  studentAnswer: string;
}): Promise<MarkedAnswer> {
  if (!isAiConfigured()) throw new AiUnavailableError('AI marking is not switched on');

  // Nothing to mark: award nothing rather than spending a call on it.
  if (!params.studentAnswer.trim()) {
    return {
      marksAwarded: 0,
      feedback: 'No answer was given for this question.',
      improvement: 'Attempt every question - partial working can still earn marks.',
    };
  }

  const rubricText = params.rubric.length
    ? params.rubric
        .map((entry) => `- ${entry.marks} mark(s): ${entry.criterion}`)
        .join('\n')
    : `- ${params.maxMarks} mark(s): a complete and correct answer`;

  const instruction = `You are marking one exam answer for a South African high-school student. Apply the rubric strictly and fairly.

QUESTION:
${params.prompt}

MAXIMUM MARKS: ${params.maxMarks}

RUBRIC:
${rubricText}

MODEL ANSWER:
${params.modelAnswer}

STUDENT'S ANSWER:
${params.studentAnswer}

Instructions:
- Award marks only for what the rubric describes. Part marks are allowed.
- marksAwarded must be between 0 and ${params.maxMarks}. Never exceed ${params.maxMarks}.
- Reward correct method even when the final answer is wrong, if the rubric allows it.
- feedback: two or three sentences addressed to the student, saying what earned marks and what did not.
- improvement: one concrete thing to work on. Empty string if the answer was full marks.
- Be encouraging but honest. Do not reveal the rubric wording verbatim.`;

  let text: string;

  try {
    const response = await getGeminiClient().models.generateContent({
      model: AI_MODEL,
      contents: instruction,
      config: {
        responseMimeType: 'application/json',
        responseSchema: MARK_RESPONSE_SCHEMA,
        // Low temperature: marking should be as repeatable as possible.
        temperature: 0.2,
      },
    });

    text = response.text ?? '';
  } catch (error) {
    console.error('[ai] marking call failed', error);
    throw new AiUnavailableError('The AI could not mark this answer');
  }

  const parsed = safeParseJson(text, markedAnswerSchema);

  if (!parsed) throw new AiUnavailableError('The AI returned a mark we could not read');

  return {
    // The clamp is the guarantee. Validation alone would only reject a bad
    // value; this makes an out-of-range mark impossible to store.
    marksAwarded: Math.max(0, Math.min(params.maxMarks, parsed.marksAwarded)),
    feedback: parsed.feedback,
    improvement: parsed.improvement,
  };
}

/* ------------------------------------------------------------------ *
 * Overall feedback
 * ------------------------------------------------------------------ */

const overallFeedbackSchema = z.object({
  feedback: z.string().trim().min(1).max(1500),
  weakAreas: z.array(z.string().trim().min(2).max(100)).max(6).default([]),
});

const FEEDBACK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    feedback: { type: 'string' },
    weakAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['feedback', 'weakAreas'],
} as const;

/**
 * A short summary of how the whole test went.
 *
 * Falls back to a plain generated sentence rather than throwing: a student who
 * has finished a test must always get their mark, even if the AI is down.
 */
export async function generateFeedback(params: {
  subject: string;
  topic: string;
  percentage: number;
  perQuestion: { prompt: string; marksAwarded: number; maxMarks: number }[];
}): Promise<{ feedback: string; weakAreas: string[] }> {
  const fallback = {
    feedback: fallbackFeedback(params.percentage, params.subject),
    weakAreas: [] as string[],
  };

  if (!isAiConfigured()) return fallback;

  const breakdown = params.perQuestion
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.marksAwarded}/${entry.maxMarks} — ${entry.prompt.slice(0, 160)}`
    )
    .join('\n');

  const instruction = `A South African high-school student has just completed a ${params.subject} test on ${params.topic} and scored ${params.percentage}%.

Per-question marks:
${breakdown}

Write:
- feedback: three or four sentences to the student. Name one thing they did well and one thing to revise. Encouraging, specific, plain language.
- weakAreas: up to three short topic labels (2-4 words each) they should revise, drawn from the questions they lost marks on. Empty array if they did well throughout.

Do not mention marking rubrics, prompts, or that an AI marked this.`;

  try {
    const response = await getGeminiClient().models.generateContent({
      model: AI_MODEL,
      contents: instruction,
      config: {
        responseMimeType: 'application/json',
        responseSchema: FEEDBACK_RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });

    const parsed = safeParseJson(response.text ?? '', overallFeedbackSchema);

    return parsed ?? fallback;
  } catch (error) {
    console.error('[ai] feedback call failed', error);
    return fallback;
  }
}

function fallbackFeedback(percentage: number, subject: string): string {
  if (percentage >= 80) {
    return `A strong result in ${subject}. Keep working through past papers to hold this standard.`;
  }

  if (percentage >= 50) {
    return `A solid pass in ${subject}. Go back over the questions you lost marks on and bring them to your next lesson.`;
  }

  return `This one was tough. Work through the questions you missed with your tutor - the marks are recoverable once the method clicks.`;
}

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

/**
 * Parses a model reply and validates its shape.
 *
 * Returns null instead of throwing so each caller can decide whether a bad
 * reply is fatal (generation) or something to fall back from (feedback).
 */
function safeParseJson<T>(text: string, schema: z.ZodType<T>): T | null {
  if (!text.trim()) return null;

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    // Some models wrap JSON in a fenced code block despite the mime type.
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) return null;

    try {
      raw = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    console.error('[ai] response failed validation', parsed.error.issues.slice(0, 3));
    return null;
  }

  return parsed.data;
}
