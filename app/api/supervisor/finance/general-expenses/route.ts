import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGeneralExpenses, createGeneralExpense, deleteGeneralExpense } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }
    const allowedRoles = ['admin', 'finance', 'finance_supervisor'];
    const hasAccess = session.role.split(',').map(r => r.trim()).some(r => allowedRoles.includes(r));
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح لك باستعراض المصروفات' }, { status: 403 });
    }
    const expenses = await getGeneralExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('general-expenses GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المصروفات' }, { status: 500 });
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
      return NextResponse.json({ error: 'غير مصرح لك بإضافة مصروفات' }, { status: 403 });
    }
    const body = await req.json();
    const { title, amount, date, notes } = body;
    if (!title || !amount || !date) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 });
    }
    const expense = await createGeneralExpense({
      title,
      amount: parseFloat(amount),
      date,
      notes: notes || '',
      supervisorId: session.id,
      supervisorName: session.name
    });
    return NextResponse.json({ expense });
  } catch (error) {
    console.error('general-expenses POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة المصروف' }, { status: 500 });
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
      return NextResponse.json({ error: 'غير مصرح لك بحذف المصروفات' }, { status: 403 });
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
    const success = await deleteGeneralExpense(id);
    if (!success) {
      return NextResponse.json({ error: 'فشل حذف المصروف' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('general-expenses DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المصروف' }, { status: 500 });
  }
}
