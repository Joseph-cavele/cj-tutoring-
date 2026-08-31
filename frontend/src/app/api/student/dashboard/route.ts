import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import { Attendance, Lesson, Student, TestAttempt } from '@/models';

/**
 * Student-only route to retrieve dashboard summary data.
 */
export async function GET() {
  const authCheck = await requireApiRole('student');
  if (authCheck.response) return authCheck.response;

  await connectDB();

  const student = await Student.findOne({ user: authCheck.user.id })
    .populate<{ grade: { name: string } }>('grade', 'name')
    .populate<{ subjects: { name: string }[] }>('subjects', 'name')
    .lean();

  if (!student) {
    return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
  }

  const now = new Date();

  const [upcomingLessons, recentAttempts, attendanceRecords] = await Promise.all([
    Lesson.find({ student: student._id, startTime: { $gte: now } })
      .sort({ startTime: 1 })
      .limit(5)
      .lean(),
    TestAttempt.find({ student: student._id })
      .populate<{ test: { title: string; totalMarks: number } }>('test', 'title totalMarks')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Attendance.find({ student: student._id }).lean(),
  ]);

  const totalClasses = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((a) => a.status === 'present').length;
  const attendanceRate = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

  return NextResponse.json({
    student: {
      id: student._id.toString(),
      grade: student.grade?.name ?? 'Not set',
      subjects: (student.subjects ?? []).map((s) => s.name),
    },
    upcomingLessons,
    recentAttempts,
    attendanceRate,
  });
}
