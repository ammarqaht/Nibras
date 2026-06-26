import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyStudentToken } from './lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect student routes (except login)
  if (pathname.startsWith('/student') && !pathname.startsWith('/student/login')) {
    const token = request.cookies.get('student_session')?.value;
    if (!token || !verifyStudentToken(token)) {
      const loginUrl = new URL('/student/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/api/student') && pathname !== '/api/student/auth') {
    const token = request.cookies.get('student_session')?.value;
    if (!token || !verifyStudentToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/supervisor/:path*',
    '/api/supervisor/:path*',
    '/student/:path*',
    '/api/student/:path*',
  ],
};
