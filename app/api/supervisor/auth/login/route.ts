import { NextResponse } from 'next/server';
import { getSupervisorByEmail, hashPassword } from '@/lib/services';
import { signToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const supervisor = await getSupervisorByEmail(normalizedEmail);
    if (!supervisor) {
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const hashedInput = hashPassword(password);
    if (supervisor.passwordHash !== hashedInput) {
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    // Force admin role for the owner emails to prevent lockouts
    const adminEmails = ['admin', 'admin@nibras.com', 'mohammed.qahtani', 'mohammed.yabis', '2000', '2001', '2005'];
    if (adminEmails.includes(supervisor.email.toLowerCase().trim())) {
      supervisor.role = 'admin';
    }

    const sessionData = {
      id: supervisor.id,
      email: supervisor.email,
      name: supervisor.name,
      role: supervisor.role
    };

    const token = signToken(sessionData);

    const response = NextResponse.json({ success: true, user: sessionData });
    // Set HTTP-Only cookie valid for 7 days
    response.cookies.set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول' }, { status: 500 });
  }
}
