import { connectDB } from '@/lib/mongodb';
import { Parent, Student } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';

export class OwnershipError extends Error {
  constructor(
    message: string = 'Forbidden: You do not have permission to access this record.',
    readonly status: number = 403
  ) {
    super(message);
    this.name = 'OwnershipError';
  }
}

/**
 * Verifies that the authenticated user is the student corresponding to targetStudentId.
 * Throws OwnershipError (403) if verification fails.
 */
export async function assertStudentOwnership(
  authenticatedUserId: string,
  targetStudentId: string
): Promise<boolean> {
  await connectDB();

  const student = await Student.findOne({ user: authenticatedUserId }).select('_id').lean();

  if (!student || student._id.toString() !== targetStudentId) {
    throw new OwnershipError('Forbidden: You can only access your own student records.');
  }

  return true;
}

/**
 * Verifies that the authenticated user is a parent linked to targetStudentId.
 * Throws OwnershipError (403) if verification fails.
 */
export async function assertParentChildRelationship(
  authenticatedUserId: string,
  targetStudentId: string
): Promise<boolean> {
  await connectDB();

  const parent = await Parent.findOne({ user: authenticatedUserId }).select('students').lean();

  if (!parent) {
    throw new OwnershipError('Forbidden: Parent account not found.');
  }

  const isLinked = (parent.students ?? []).some(
    (studentId) => studentId.toString() === targetStudentId
  );

  if (!isLinked) {
    throw new OwnershipError('Forbidden: You can only access records for your linked children.');
  }

  return true;
}

/**
 * Unified authorization gate for student-specific resources.
 * - Tutors can access all student records.
 * - Students can only access their own records.
 * - Parents can only access their linked children's records.
 */
export async function assertCanAccessStudent(
  user: SessionUser,
  targetStudentId: string
): Promise<boolean> {
  if (user.role === 'tutor') {
    return true;
  }

  if (user.role === 'student') {
    return assertStudentOwnership(user.id, targetStudentId);
  }

  if (user.role === 'parent') {
    return assertParentChildRelationship(user.id, targetStudentId);
  }

  throw new OwnershipError('Forbidden: You do not have access to this student record.');
}
