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
