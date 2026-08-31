import crypto from 'node:crypto';
import { TOKEN_PURPOSES } from '@/models/PasswordToken';
import { ROLES } from '@/models/types';
import { createPasswordSchema, forgotPasswordSchema } from '@/validations/password';
import {
  createPasswordLink,
  hashToken,
  resetPasswordLink,
} from '@/services/password.service';
import { requireApiAuth, requireApiRole } from '@/lib/auth/middleware';
import {
  assertCanAccessStudent,
  assertParentChildRelationship,
  assertStudentOwnership,
  OwnershipError,
} from '@/lib/auth/ownership';
import * as authModule from '@/auth';
import { Student, Parent } from '@/models';

// Mock NextAuth
jest.mock('../../../auth', () => ({
  auth: jest.fn(),
}));

// Mock MongoDB
jest.mock('../../mongodb', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock models
jest.mock('../../../models', () => ({
  Student: {
    findOne: jest.fn(),
  },
  Parent: {
    findOne: jest.fn(),
  },
}));

describe('RBAC Roles and Token Purposes', () => {
  it('has exactly three user roles: tutor, student, parent', () => {
    expect(ROLES).toEqual(['student', 'parent', 'tutor']);
    expect(ROLES.length).toBe(3);
  });

  it('supports token purposes: setup, reset, invite', () => {
    expect(TOKEN_PURPOSES).toContain('setup');
    expect(TOKEN_PURPOSES).toContain('reset');
    expect(TOKEN_PURPOSES).toContain('invite');
  });
});

describe('Token Generation, Hashing, and Setup Links', () => {
  it('generates SHA-256 hash of token correctly', () => {
    const plain = 'test-token-12345';
    const expected = crypto.createHash('sha256').update(plain).digest('hex');
    expect(hashToken(plain)).toBe(expected);
  });

  it('builds password setup link using custom or default domain', () => {
    const token = 'sample_secure_token';
    const link = createPasswordLink(token, 'https://cjprivatetutoring.co.za');
    expect(link).toBe('https://cjprivatetutoring.co.za/create-password?token=sample_secure_token');
  });

  it('builds password reset link correctly', () => {
    const token = 'reset_token_xyz';
    const link = resetPasswordLink(token, 'https://cjprivatetutoring.co.za');
    expect(link).toBe('https://cjprivatetutoring.co.za/reset-password?token=reset_token_xyz');
  });
});

describe('Password Validation Schema', () => {
  it('validates password meeting security requirements', () => {
    const valid = createPasswordSchema.safeParse({
      token: 'valid_token_string_123',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = createPasswordSchema.safeParse({
      token: 'valid_token_string_123',
      password: 'Ab1',
      confirmPassword: 'Ab1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords without a number', () => {
    const result = createPasswordSchema.safeParse({
      token: 'valid_token_string_123',
      password: 'NoNumbersHere',
      confirmPassword: 'NoNumbersHere',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched password and confirmPassword', () => {
    const result = createPasswordSchema.safeParse({
      token: 'valid_token_string_123',
      password: 'SecurePassword123',
      confirmPassword: 'DifferentPassword123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('The passwords do not match');
    }
  });

  it('validates forgot password email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'valid@example.com' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'invalid-email' }).success).toBe(false);
  });
});

describe('API Authorization Middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requireApiAuth returns 401 when no session exists', async () => {
    (authModule.auth as jest.Mock).mockResolvedValue(null);

    const result = await requireApiAuth();
    expect(result.user).toBeNull();
    expect(result.response).not.toBeNull();
    expect(result.response?.status).toBe(401);
  });

  it('requireApiAuth returns user when session is valid', async () => {
    (authModule.auth as jest.Mock).mockResolvedValue({
      user: { id: 'u1', name: 'Tutor', email: 'tutor@test.com', role: 'tutor' },
    });

    const result = await requireApiAuth();
    expect(result.user).not.toBeNull();
    expect(result.user?.role).toBe('tutor');
    expect(result.response).toBeNull();
  });

  it('requireApiRole returns 403 when user role does not match required role', async () => {
    (authModule.auth as jest.Mock).mockResolvedValue({
      user: { id: 'u2', name: 'Student', email: 'student@test.com', role: 'student' },
    });

    const result = await requireApiRole('tutor');
    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it('requireApiRole allows matching role', async () => {
    (authModule.auth as jest.Mock).mockResolvedValue({
      user: { id: 'u1', name: 'Tutor', email: 'tutor@test.com', role: 'tutor' },
    });

    const result = await requireApiRole('tutor');
    expect(result.user).not.toBeNull();
    expect(result.response).toBeNull();
  });

  it('requireApiRole allows role in array of allowed roles', async () => {
    (authModule.auth as jest.Mock).mockResolvedValue({
      user: { id: 'u3', name: 'Parent', email: 'parent@test.com', role: 'parent' },
    });

    const result = await requireApiRole(['tutor', 'parent']);
    expect(result.user).not.toBeNull();
    expect(result.response).toBeNull();
  });
});

describe('Record Ownership and Relationship Verification', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('assertStudentOwnership allows student accessing own ID', async () => {
    (Student.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'student_123' }),
      }),
    });

    await expect(assertStudentOwnership('user_student_1', 'student_123')).resolves.toBe(true);
  });

  it('assertStudentOwnership throws 403 OwnershipError on ID tampering', async () => {
    (Student.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'student_123' }),
      }),
    });

    await expect(assertStudentOwnership('user_student_1', 'student_999')).rejects.toThrow(
      OwnershipError
    );
  });

  it('assertParentChildRelationship allows parent accessing linked child', async () => {
    (Parent.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ students: ['child_1', 'child_2'] }),
      }),
    });

    await expect(assertParentChildRelationship('user_parent_1', 'child_1')).resolves.toBe(true);
  });

  it('assertParentChildRelationship throws 403 on unlinked student ID', async () => {
    (Parent.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ students: ['child_1', 'child_2'] }),
      }),
    });

    await expect(assertParentChildRelationship('user_parent_1', 'child_other')).rejects.toThrow(
      OwnershipError
    );
  });

  it('assertCanAccessStudent allows tutor unrestricted access', async () => {
    const tutorUser = { id: 'tutor_1', role: 'tutor' as const };
    await expect(assertCanAccessStudent(tutorUser, 'any_student_id')).resolves.toBe(true);
  });
});
