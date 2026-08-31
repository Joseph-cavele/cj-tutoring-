import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Student } from '@/models';

/**
 * Tutor-only route to list all students across the tutoring business.
 * Rejects student and parent roles with 403 Forbidden.
 */
export async function GET() {
  const authCheck = await requireApiRole('tutor');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const students = await Student.find()
    .populate<{ user: { name: string; email: string; phone?: string; isActive: boolean } }>(
      'user',
      'name email phone isActive'
    )
    .populate<{ grade: { name: string; level: number } }>('grade', 'name level')
    .populate<{ subjects: { name: string; code: string }[] }>('subjects', 'name code')
    .populate<{ parents: { user: { name: string; email: string } }[] }>({
      path: 'parents',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ createdAt: -1 })
    .lean();

  const data = students.map((student) => ({
    studentId: student._id.toString(),
    name: student.user?.name ?? 'Unknown',
    email: student.user?.email ?? '',
    phone: student.user?.phone ?? null,
    isActive: student.user?.isActive ?? false,
    grade: student.grade?.name ?? 'Unassigned',
    subjects: (student.subjects ?? []).map((s) => s.name),
    parents: (student.parents ?? []).map((p) => ({
      name: p.user?.name ?? 'Parent',
      email: p.user?.email ?? '',
    })),
  }));

  return NextResponse.json({ students: data });
}
