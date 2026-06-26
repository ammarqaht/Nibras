import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs in Edge runtime — no Node.js crypto available.
// We only check cookie *existence* here for redirect/gating.
// Full HMAC token verification happens inside each API route handler (Node.js runtime).

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect student pages (redirect to login if no session cookie)
  if (pathname.startsWith('/student') && !pathname.startsWith('/student/login')) {
    const hasToken = !!request.cookies.get('student_session')?.value;
    if (!hasToken) {
      return NextResponse.redirect(new URL('/student/login', request.url));
    }
  }

  // Protect student API routes (return 401 if no session cookie)
  if (pathname.startsWith('/api/student') && pathname !== '/api/student/auth') {
    const hasToken = !!request.cookies.get('student_session')?.value;
    if (!hasToken) {
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
