import { NextResponse } from 'next/server';

import { getAuthorizedUser } from '@/lib/auth/guard';
import { recordLessonSchema } from '@/validations/lesson';
import { LessonError, listLessonsFor, recordLesson } from '@/services/lesson.service';

// Reads the session cookie and the database on every call, so it must never
// be prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * GET /api/lessons
 *
 * Lessons the caller is entitled to, newest first. The scope is decided
 * server-side from the session; `studentId` can only narrow it.
 */
export async function GET(request: Request) {
  const user = await getAuthorizedUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId') ?? undefined;

  // Rejected here rather than passed to Mongo, where a malformed id throws a
  // CastError that would surface as a 500.
  if (studentId && !/^[0-9a-fA-F]{24}$/.test(studentId)) {
    return NextResponse.json({ error: 'Invalid studentId' }, { status: 400 });
  }

  const lessons = await listLessonsFor({ user, studentId });

  return NextResponse.json({ lessons });
}

/**
 * POST /api/lessons
 *
 * Records or updates the write-up for one booking. Tutor only - the service
 * enforces that, so the check is not repeated here.
 */
export async function POST(request: Request) {
  const user = await getAuthorizedUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = recordLessonSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the form and try again',
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await recordLesson({ user, input: parsed.data });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof LessonError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to record lesson:', error);
    return NextResponse.json({ error: 'Could not record the lesson' }, { status: 500 });
  }
}
