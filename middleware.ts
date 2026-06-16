import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Intercept supervisor dashboard and supervisor API endpoints
  if (pathname.startsWith('/supervisor') || pathname.startsWith('/api/supervisor')) {
    const host = request.headers.get('host') || '';

    // Allow access under:
    // 1. Local development environment (localhost / 127.0.0.1)
    // 2. Production domains containing "supervisor" (e.g., supervisor.nibras.com)
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const isSupervisorDomain = host.toLowerCase().includes('supervisor');

    if (!isLocal && !isSupervisorDomain) {
      // Return a 404 error to obscure the existence of the supervisor portal to students/public
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

// Map middleware matcher to target routes
export const config = {
  matcher: [
    '/supervisor/:path*',
    '/api/supervisor/:path*',
  ],
};
