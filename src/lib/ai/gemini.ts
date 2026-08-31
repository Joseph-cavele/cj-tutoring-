import { GoogleGenAI } from '@google/genai';

/**
 * Server-only Gemini client. The key must never reach the browser
 * (CLAUDE.md section 33), so this module is only ever imported by
 * route handlers and services.
 */
let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY is not set. Add it to .env.local');
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

// gemini-2.5-flash is retired for new API consumers, so the default has to be
// a current model. Override with AI_MODEL when a newer one ships.
export const AI_MODEL = process.env.AI_MODEL ?? 'gemini-3.6-flash';

/**
 * Statuses that mean "ask again", not "this request was wrong".
 *
 * 503 is the common one: Gemini answers it when the model is momentarily
 * overloaded, and it says nothing about the prompt. 429 is rate limiting and
 * the 5xx family is upstream trouble. A 400 is never here on purpose - a
 * malformed request fails the same way however many times it is sent.
 */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

function statusOf(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  const raw = candidate?.status ?? candidate?.code;

  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);

  // Some SDK failures carry the status only in the message text.
  const message = error instanceof Error ? error.message : String(error ?? '');
  const matched = message.match(/\b(429|500|502|503|504)\b/);

  return matched ? Number(matched[1]) : undefined;
}

export function isTransientAiError(error: unknown): boolean {
  const status = statusOf(error);

  if (status !== undefined && TRANSIENT_STATUSES.has(status)) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('overloaded') || message.includes('unavailable');
}

/** True when Gemini was busy, which is worth telling the user apart. */
export function isOverloadedAiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return statusOf(error) === 503 || message.includes('overloaded');
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GenerateContentArgs = Parameters<
  GoogleGenAI['models']['generateContent']
>[0];

/**
 * generateContent with a short retry on transient failures.
 *
 * Generation already takes around twenty seconds, so the backoff is
 * deliberately small and the attempt count low: the aim is to ride out a
 * moment of overload, not to keep a tutor watching a spinner. Anything that is
 * not transient is rethrown immediately rather than tried again.
 */
export async function generateContentWithRetry(
  args: GenerateContentArgs,
  { attempts = 3 }: { attempts?: number } = {}
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getGeminiClient().models.generateContent(args);
    } catch (error) {
      lastError = error;

      if (!isTransientAiError(error) || attempt === attempts) throw error;

      // 1s then 3s, with jitter so concurrent callers do not retry in step.
      const backoff = (attempt === 1 ? 1000 : 3000) + Math.random() * 400;
      console.warn(
        `[ai] ${statusOf(error) ?? 'transient'} from Gemini, retrying in ${Math.round(backoff)}ms (attempt ${attempt} of ${attempts})`
      );

      await wait(backoff);
    }
  }

  throw lastError;
}

/**
 * Guardrails from CLAUDE.md section 17. The assistant supports the tutor,
 * it does not replace them, and it stays inside the subjects the platform
 * actually teaches (section 4).
 */
export const SYSTEM_INSTRUCTION = `You are the CJ Private Tutoring study assistant, helping South African high-school students.

Scope:
- Mathematics, Grades 8 to 12.
- Physical Science, Grades 10 to 12.
- If a question falls outside these subjects and grades, say so briefly and steer the student back to their subjects.

How to answer:
- Follow the South African CAPS curriculum and use South African terminology.
- Teach, do not just answer. Show the working, step by step, and explain why each step follows.
- For a problem the student is clearly working through, guide them to the next step rather than dumping the final answer.
- Keep language plain and age-appropriate. Short paragraphs.
- Use LaTeX-free plain text for maths where possible, for example "x^2" and "sqrt(3)".
- When a student is stuck repeatedly, suggest they raise it with their tutor in the next lesson.

Boundaries:
- You do not replace the tutor, and you never claim to.
- You do not help with anything that is being assessed as an exam or test in progress.
- You do not discuss pricing, payments, accounts, or other students.
- If you are unsure, say so plainly rather than guessing.`;
