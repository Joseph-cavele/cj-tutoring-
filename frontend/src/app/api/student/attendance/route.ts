import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { assertStudentOwnership, OwnershipError } from '@/lib/auth/ownership';
import { connectDB } from '@/lib/mongodb';
import { Attendance, Student } from '@/models';

/**
 * Student-only route to retrieve their attendance history.
 * Verifies student ownership to prevent unauthorized access via URL/ID manipulation.
 */
export async function GET(request: Request) {
  const authCheck = await requireApiRole('student');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const student = await Student.findOne({ user: authCheck.user.id }).select('_id').lean();

  if (!student) {
    return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const targetStudentId = searchParams.get('studentId') ?? student._id.toString();

  try {
    await assertStudentOwnership(authCheck.user.id, targetStudentId);
  } catch (error) {
    if (error instanceof OwnershipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const records = await Attendance.find({ student: targetStudentId })
    .populate<{ lesson: { subject?: string; title?: string } }>('lesson')
    .sort({ date: -1 })
    .lean();

  return NextResponse.json({ attendance: records });
}
