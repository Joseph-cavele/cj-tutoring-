import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Student, Test } from '@/models';

/**
 * Student-only route to retrieve tests available for the student.
 */
export async function GET() {
  const authCheck = await requireApiRole('student');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const student = await Student.findOne({ user: authCheck.user.id })
    .select('grade subjects')
    .lean();

  if (!student) {
    return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
  }

  const tests = await Test.find({
    grade: student.grade,
    published: true,
  })
    .populate<{ subject: { name: string } }>('subject', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ tests });
}
