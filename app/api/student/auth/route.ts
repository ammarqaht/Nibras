import { NextRequest, NextResponse } from 'next/server';
import { getStudentByCredentials } from '@/lib/services';
import { signStudentToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const membershipNo = Number(body.membershipNo);
    const nationalId = String(body.nationalId || '').trim();

    if (!membershipNo || !nationalId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const student = await getStudentByCredentials(membershipNo, nationalId);
    if (!student) {
      return NextResponse.json({ error: 'رقم العضوية أو رقم الهوية غير صحيح' }, { status: 401 });
    }

    const token = signStudentToken({
      id: student.id,
      membershipNo: student.membershipNo,
      name: student.studentName,
      stage: student.stage,
      grade: student.grade,
      groupId: student.groupId,
    });

    const res = NextResponse.json({ ok: true, name: student.studentName });
    res.cookies.set('student_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('student_session', '', { maxAge: 0, path: '/' });
  return res;
}
