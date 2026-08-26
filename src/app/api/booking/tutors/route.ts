import { NextResponse } from 'next/server';

import { getAuthorizedUser } from '@/lib/auth/guard';
import { getTutorsForSubject } from '@/services/availability.service';
import { objectId } from '@/validations/lesson-booking';

/**
 * Tutors who teach one subject (brief section 6).
 *
 * Inactive and unverified tutors are filtered out in the service, so an
 * unapproved tutor cannot be reached by guessing a subject id.
 */
export async function GET(request: Request) {
  const user = await getAuthorizedUser(['student', 'parent', 'admin']);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subjectId = new URL(request.url).searchParams.get('subjectId');
  const parsed = objectId.safeParse(subjectId);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a subject first' }, { status: 400 });
  }

  try {
    const tutors = await getTutorsForSubject(parsed.data);
    return NextResponse.json({ tutors });
  } catch (error) {
    console.error('[api/booking/tutors] failed', error);
    return NextResponse.json({ error: 'Could not load tutors' }, { status: 500 });
  }
}
