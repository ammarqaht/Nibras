import crypto from 'crypto';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'nibras-supervisors-dashboard-secret-key-987654321';
const STUDENT_SECRET = process.env.STUDENT_JWT_SECRET || 'nibras-students-portal-secret-key-123456789';

export type UserSession = {
  id: number;
  email: string;
  name: string;
  role: string; // 'admin' | 'supervisor'
};

/**
 * Signs a payload creating a standard signed JWT token using HMAC-SHA256.
 */
export function signToken(payload: UserSession): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a JWT token signature and decodes the session payload.
 */
export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UserSession;
  } catch {
    return null;
  }
}

/**
 * Extracts the user session from the request cookies.
 */
export function getSession(req: NextRequest): UserSession | null {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ==================== STUDENT AUTH ====================

export type StudentSession = {
  id: number;        // registrationId
  membershipNo: number;
  name: string;
  stage: string;
  grade: string;
  groupId: number | null;
};

export function signStudentToken(payload: StudentSession): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', STUDENT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyStudentToken(token: string): StudentSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', STUDENT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StudentSession;
  } catch {
    return null;
  }
}

export function getStudentSession(req: NextRequest): StudentSession | null {
  const token = req.cookies.get('student_session')?.value;
  if (!token) return null;
  return verifyStudentToken(token);
}
