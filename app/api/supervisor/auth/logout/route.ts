import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: 'session',
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0 // clear cookie
  });
  return response;
}
