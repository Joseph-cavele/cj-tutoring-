import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Attendance } from '@/models';

/**
 * Tutor-only route to list and manage student attendance.
 * Rejects student and parent roles with 403 Forbidden.
 */
export async function GET() {
  const authCheck = await requireApiRole('tutor');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const records = await Attendance.find()
    .populate<{ student: { user: { name: string } } }>({
      path: 'student',
      populate: { path: 'user', select: 'name' },
    })
    .populate<{ lesson: { subject?: string; date?: Date } }>('lesson')
    .sort({ date: -1 })
    .limit(200)
    .lean();

  return NextResponse.json({ attendance: records });
}
