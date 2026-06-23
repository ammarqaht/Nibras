import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOtherRevenues, createOtherRevenue, deleteOtherRevenue } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }
    const allowedRoles = ['admin', 'finance', 'finance_supervisor'];
    const hasAccess = session.role.split(',').map(r => r.trim()).some(r => allowedRoles.includes(r));
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح لك باستعراض الإيرادات' }, { status: 403 });
    }
    const revenues = await getOtherRevenues();
    return NextResponse.json({ revenues });
  } catch (error) {
    console.error('other-revenues GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الإيرادات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }
    const allowedRoles = ['admin', 'finance', 'finance_supervisor'];
    const hasAccess = session.role.split(',').map(r => r.trim()).some(r => allowedRoles.includes(r));
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح لك بإضافة إيرادات' }, { status: 403 });
    }
    const body = await req.json();
    const { title, amount, date, notes } = body;
    if (!title || !amount || !date) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 });
    }
    const revenue = await createOtherRevenue({
      title,
      amount: parseFloat(amount),
      date,
      notes: notes || '',
      supervisorId: session.id,
      supervisorName: session.name
    });
    return NextResponse.json({ revenue });
  } catch (error) {
    console.error('other-revenues POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة الإيراد' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }
    const allowedRoles = ['admin', 'finance', 'finance_supervisor'];
    const hasAccess = session.role.split(',').map(r => r.trim()).some(r => allowedRoles.includes(r));
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح لك بحذف الإيرادات' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    }
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'المعرف غير صالح' }, { status: 400 });
    }
    const success = await deleteOtherRevenue(id);
    if (!success) {
      return NextResponse.json({ error: 'فشل حذف الإيراد' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('other-revenues DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الإيراد' }, { status: 500 });
  }
}
