import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow all requests since pages are already protected by password-based authentication
  return NextResponse.next();
}

// Map middleware matcher to target routes
export const config = {
  matcher: [
    '/supervisor/:path*',
    '/api/supervisor/:path*',
  ],
};
