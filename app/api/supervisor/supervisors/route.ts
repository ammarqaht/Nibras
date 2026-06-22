import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllSupervisors, createSupervisor, deleteSupervisor, hashPassword, updateSupervisor } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisors = await getAllSupervisors();
    // Exclude password hashes for security
    const cleanList = supervisors.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      groupIds: s.groupIds,
      createdAt: s.createdAt
    }));

    return NextResponse.json({ supervisors: cleanList });
  } catch (error) {
    console.error('Supervisors GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب قائمة المشرفين' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, password, role, groupIds } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'يرجى إكمال الحقول الإلزامية' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const supervisors = await getAllSupervisors();
    const exists = supervisors.some(s => s.email.toLowerCase() === normalizedEmail);
    if (exists) {
      return NextResponse.json({ error: 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً' }, { status: 400 });
    }

    const created = await createSupervisor({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role,
      groupIds: groupIds || ''
    });

    return NextResponse.json({ success: true, supervisor: created });
  } catch (error) {
    console.error('Supervisors POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة المشرف' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ error: 'معرف المشرف مطلوب' }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'المعرف غير صحيح' }, { status: 400 });
    }

    // Prevent deleting primary admin account
    const supervisors = await getAllSupervisors();
    const target = supervisors.find(s => s.id === id);
    if (target && (target.email === 'admin' || target.email === 'admin@nibras.com')) {
      return NextResponse.json({ error: 'لا يمكن حذف الحساب الرئيسي للمدير العام' }, { status: 400 });
    }

    const success = await deleteSupervisor(id);
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'فشل حذف المشرف' }, { status: 400 });
    }
  } catch (error) {
    console.error('Supervisors DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المشرف' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const id = parseInt(body.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'معرّف المشرف غير صحيح' }, { status: 400 });
    }

    const { name, email, password, role, groupIds } = body;

    // Check email uniqueness if email is changed
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const supervisors = await getAllSupervisors();
      const exists = supervisors.some(s => s.id !== id && s.email.toLowerCase() === normalizedEmail);
      if (exists) {
        return NextResponse.json({ error: 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً لمشرف آخر' }, { status: 400 });
      }
    }

    // Prevent editing primary admin account to a non-admin role
    const supervisors = await getAllSupervisors();
    const target = supervisors.find(s => s.id === id);
    if (target && (target.email === 'admin' || target.email === 'admin@nibras.com')) {
      if (role && role !== 'admin') {
        return NextResponse.json({ error: 'لا يمكن تغيير دور المدير العام الرئيسي' }, { status: 400 });
      }
    }

    const updated = await updateSupervisor(id, {
      name: name ? String(name).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
      password: password || undefined,
      role: role || undefined,
      groupIds: groupIds !== undefined ? groupIds : undefined
    });

    if (!updated) {
      return NextResponse.json({ error: 'المشرف غير موجود أو فشل التحديث' }, { status: 400 });
    }

    return NextResponse.json({ success: true, supervisor: updated });
  } catch (error) {
    console.error('Supervisors PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل بيانات المشرف' }, { status: 500 });
  }
}
