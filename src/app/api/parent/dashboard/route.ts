import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Attendance, Lesson, Parent, Student, TestAttempt } from '@/models';

/**
 * Parent-only route to retrieve the overview dashboard for linked children.
 */
export async function GET() {
  const authCheck = await requireApiRole('parent');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const parent = await Parent.findOne({ user: authCheck.user.id })
    .populate<{
      students: {
        _id: string;
        user?: { name: string; email: string };
        grade?: { name: string };
      }[];
    }>({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email' },
        { path: 'grade', select: 'name' },
      ],
    })
    .lean();

  if (!parent) {
    return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
  }

  const studentIds = (parent.students ?? []).map((s) => s._id);

  const now = new Date();

  const [upcomingLessons, recentAttempts, attendanceRecords] = await Promise.all([
    Lesson.find({ student: { $in: studentIds }, startTime: { $gte: now } })
      .populate<{ student: { user: { name: string } } }>({
        path: 'student',
        populate: { path: 'user', select: 'name' },
      })
      .sort({ startTime: 1 })
      .limit(5)
      .lean(),
    TestAttempt.find({ student: { $in: studentIds } })
      .populate<{ test: { title: string } }>('test', 'title')
      .populate<{ student: { user: { name: string } } }>({
        path: 'student',
        populate: { path: 'user', select: 'name' },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Attendance.find({ student: { $in: studentIds } }).lean(),
  ]);

  const totalClasses = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((a) => a.status === 'present').length;
  const overallAttendanceRate =
    totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

  return NextResponse.json({
    children: (parent.students ?? []).map((child) => ({
      studentId: child._id.toString(),
      name: child.user?.name ?? 'Child',
      email: child.user?.email ?? '',
      grade: child.grade?.name ?? 'Unassigned',
    })),
    upcomingLessons,
    recentAttempts,
    overallAttendanceRate,
  });
}
