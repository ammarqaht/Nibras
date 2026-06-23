import { NextRequest, NextResponse } from 'next/server';
import { getSession, signToken } from '@/lib/auth';
import { getAllSupervisors, updateSupervisor } from '@/lib/services';

/**
 * Self-service account endpoint: a supervisor changes their OWN username
 * and/or password. Only ever touches the currently authenticated account
 * (by session id), never another supervisor. Admin accounts are excluded —
 * they manage credentials from the supervisors page.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisors = await getAllSupervisors();
    const me = supervisors.find((s) => s.id === session.id);
    if (!me) {
      return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 401 });
    }
    if (me.role === 'admin') {
      return NextResponse.json({ error: 'حسابات المدير العام تُدار من صفحة المشرفين' }, { status: 403 });
    }

    const body = await req.json();
    const rawUsername = body.username !== undefined ? String(body.username).trim() : undefined;
    const password = body.password !== undefined ? String(body.password) : undefined;

    if (!rawUsername && !password) {
      return NextResponse.json({ error: 'لا يوجد تغيير لحفظه' }, { status: 400 });
    }

    const update: { email?: string; password?: string } = {};
    let finalEmail = me.email;

    // Username change
    if (rawUsername !== undefined) {
      const newEmail = rawUsername.toLowerCase();
      if (!newEmail) {
        return NextResponse.json({ error: 'اسم المستخدم لا يمكن أن يكون فارغاً' }, { status: 400 });
      }
      if (/\s/.test(newEmail)) {
        return NextResponse.json({ error: 'اسم المستخدم لا يحتوي على مسافات' }, { status: 400 });
      }
      if (newEmail !== me.email) {
        const taken = supervisors.some((s) => s.id !== me.id && s.email.toLowerCase() === newEmail);
        if (taken) {
          return NextResponse.json({ error: 'اسم المستخدم مستخدم مسبقاً، اختر اسماً آخر' }, { status: 400 });
        }
        update.email = newEmail;
        finalEmail = newEmail;
      }
    }

    // Password change
    if (password !== undefined && password.length > 0) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'كلمة المرور قصيرة جداً (4 خانات على الأقل)' }, { status: 400 });
      }
      update.password = password;
    }

    if (update.email === undefined && update.password === undefined) {
      return NextResponse.json({ error: 'لا يوجد تغيير لحفظه' }, { status: 400 });
    }

    const updated = await updateSupervisor(me.id, update);
    if (!updated) {
      return NextResponse.json({ error: 'تعذّر حفظ التغييرات' }, { status: 500 });
    }

    // Re-issue the session cookie so a username change doesn't log the user out.
    const token = signToken({ id: me.id, email: finalEmail, name: me.name, role: me.role });
    const res = NextResponse.json({ success: true, username: finalEmail });
    res.cookies.set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    return res;
  } catch (error) {
    console.error('Account PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ التغييرات' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const usernameToCheck = searchParams.get('username')?.trim().toLowerCase();
    if (!usernameToCheck) {
      return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 });
    }

    if (/\s/.test(usernameToCheck)) {
      return NextResponse.json({ available: false, reason: 'يحتوي على مسافات' });
    }

    const supervisors = await getAllSupervisors();
    const taken = supervisors.some((s) => s.id !== session.id && s.email.toLowerCase() === usernameToCheck);

    return NextResponse.json({ available: !taken });
  } catch (error) {
    console.error('Account GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء فحص اسم المستخدم' }, { status: 500 });
  }
}
