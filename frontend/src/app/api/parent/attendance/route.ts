import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { assertParentChildRelationship, OwnershipError } from '@/lib/auth/ownership';
import { connectDB } from '@/lib/mongodb';
import { Attendance, Parent } from '@/models';

/**
 * Parent-only route to retrieve attendance records for linked children.
 * Verifies that the requested child is linked to the parent before returning data.
 */
export async function GET(request: Request) {
  const authCheck = await requireApiRole('parent');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const parent = await Parent.findOne({ user: authCheck.user.id }).select('students').lean();

  if (!parent) {
    return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  let filterStudentIds: string[] = [];

  if (studentId) {
    try {
      await assertParentChildRelationship(authCheck.user.id, studentId);
      filterStudentIds = [studentId];
    } catch (error) {
      if (error instanceof OwnershipError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    filterStudentIds = (parent.students ?? []).map((id) => id.toString());
  }

  const records = await Attendance.find({ student: { $in: filterStudentIds } })
    .populate<{ student: { user: { name: string } } }>({
      path: 'student',
      populate: { path: 'user', select: 'name' },
    })
    .populate<{ lesson: { subject?: string; title?: string } }>('lesson')
    .sort({ date: -1 })
    .lean();

  return NextResponse.json({ attendance: records });
}
