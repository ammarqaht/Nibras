import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGroups, createGroup, deleteGroup } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const groups = await getGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('groups GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في جلب المجموعات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    // Creating groups is restricted to admin
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح لك بإدارة المجموعات' }, { status: 403 });
    }

    const body = await req.json();
    const { name, stage } = body;
    if (!name || !stage) {
      return NextResponse.json({ error: 'البيانات غير كاملة (الاسم والمرحلة مطلوبان)' }, { status: 400 });
    }

    const group = await createGroup(name, stage);
    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error('groups POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء المجموعة' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح لك بإدارة المجموعات' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ error: 'معرف المجموعة مطلوب' }, { status: 400 });
    }
    const id = parseInt(idStr, 10);
    const success = await deleteGroup(id);
    if (!success) {
      return NextResponse.json({ error: 'المجموعة غير موجودة أو حدث خطأ أثناء الحذف' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('groups DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المجموعة' }, { status: 500 });
  }
}
