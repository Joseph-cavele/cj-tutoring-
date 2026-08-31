import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Parent } from '@/models';

/**
 * Parent-only route to list all verified linked children for the authenticated parent.
 */
export async function GET() {
  const authCheck = await requireApiRole('parent');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const parent = await Parent.findOne({ user: authCheck.user.id })
    .populate<{
      students: {
        _id: string;
        user?: { name: string; email: string; phone?: string };
        grade?: { name: string; level: number };
        subjects?: { name: string }[];
      }[];
    }>({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'grade', select: 'name level' },
        { path: 'subjects', select: 'name' },
      ],
    })
    .lean();

  if (!parent) {
    return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
  }

  const children = (parent.students ?? []).map((student) => ({
    studentId: student._id.toString(),
    name: student.user?.name ?? 'Child',
    email: student.user?.email ?? '',
    phone: student.user?.phone ?? null,
    grade: student.grade?.name ?? 'Unassigned',
    subjects: (student.subjects ?? []).map((s) => s.name),
  }));

  return NextResponse.json({ children });
}
