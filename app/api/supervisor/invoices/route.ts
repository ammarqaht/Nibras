import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getSupervisorByEmail,
  type InvoiceItem
} from '@/lib/services';
import { supervisorDepartments } from '@/lib/finance';

export const runtime = 'nodejs';

function isFinanceOrAdmin(role: string) {
  const roles = role.split(',').map(r => r.trim());
  return roles.includes('admin') || roles.includes('secretary') || roles.includes('finance_head') || roles.includes('finance');
}

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const supervisorIdParam = searchParams.get('supervisorId') || '';

    let invoices = await getInvoices();

    // Scope: regular supervisors see only their own invoices.
    if (!isFinanceOrAdmin(supervisor.role)) {
      invoices = invoices.filter((i) => i.supervisorId === supervisor.id);
    }

    if (department) invoices = invoices.filter((i) => i.department === department);
    if (status) invoices = invoices.filter((i) => i.status === status);
    if (category) invoices = invoices.filter((i) => i.category === category);
    if (supervisorIdParam) {
      const sid = parseInt(supervisorIdParam, 10);
      invoices = invoices.filter((i) => i.supervisorId === sid);
    }

    return NextResponse.json({
      invoices,
      myRole: supervisor.role,
      myDepartments: supervisorDepartments(supervisor.role)
    });
  } catch (e) {
    console.error('invoices GET error', e);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الفواتير' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });

    const body = await req.json();
    const title = String(body.title ?? '').trim();
    const total = Number(body.total);
    const department = String(body.department ?? '').trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    const items: InvoiceItem[] = rawItems
      .map((it: any) => ({
        name: String(it.name ?? '').trim(),
        qty: Number(it.qty) || 0,
        price: Number(it.price) || 0
      }))
      .filter((it: InvoiceItem) => it.name);

    if (!title) return NextResponse.json({ error: 'يرجى إدخال عنوان/اسم الفاتورة' }, { status: 400 });
    if (!Number.isFinite(total) || total <= 0)
      return NextResponse.json({ error: 'يرجى إدخال إجمالي صحيح للفاتورة' }, { status: 400 });
    if (!department) return NextResponse.json({ error: 'يرجى تحديد القسم/الجهة' }, { status: 400 });

    // A regular supervisor can only file under one of their own department-roles.
    if (!isFinanceOrAdmin(supervisor.role)) {
      const allowed = supervisorDepartments(supervisor.role);
      if (allowed.length > 0 && !allowed.includes(department)) {
        return NextResponse.json({ error: 'غير مصرح لك بالإضافة تحت هذا القسم' }, { status: 403 });
      }
    }

    const created = await createInvoice({
      title,
      vendor: body.vendor ? String(body.vendor).trim() : null,
      invoiceDate: body.invoiceDate ? String(body.invoiceDate).trim() : null,
      category: body.category ? String(body.category).trim() : null,
      department,
      supervisorId: supervisor.id, // who entered it — from the session
      supervisorName: supervisor.name,
      groupId: body.groupId ? parseInt(body.groupId, 10) : null,
      items,
      subtotal: body.subtotal != null && body.subtotal !== '' ? Number(body.subtotal) : null,
      tax: body.tax != null && body.tax !== '' ? Number(body.tax) : null,
      total,
      currency: body.currency || 'SAR',
      imageData: typeof body.imageData === 'string' ? body.imageData : null,
      entryMode: body.entryMode === 'photo' ? 'photo' : 'manual',
      aiExtracted: body.aiExtracted === true,
      aiConfidence: body.aiConfidence != null ? Number(body.aiConfidence) : null
    });

    return NextResponse.json({ success: true, invoice: created });
  } catch (e) {
    console.error('invoices POST error', e);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الفاتورة' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });

    const body = await req.json();
    const id = parseInt(body.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'معرّف الفاتورة غير صحيح' }, { status: 400 });

    const all = await getInvoices();
    const target = all.find((i) => i.id === id);
    if (!target) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 });

    const finance = isFinanceOrAdmin(supervisor.role);
    const owner = target.supervisorId === supervisor.id;

    // Finance/admin → review actions (status / settlement). Owner → edit own pending invoice.
    if (!finance && !(owner && target.status === 'pending')) {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل هذه الفاتورة' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};

    if (finance) {
      if (body.status !== undefined) {
        patch.status = body.status;
        patch.reviewedBy = supervisor.name;
        if (body.reviewNote !== undefined) patch.reviewNote = String(body.reviewNote || '').trim() || null;
      }
      if (body.settlement !== undefined) {
        patch.settlement = body.settlement;
        patch.settledAt = body.settlement === 'handed_over' ? new Date().toISOString() : null;
      }
    }

    // Editable invoice fields (finance always, owner only while pending)
    if (finance || (owner && target.status === 'pending')) {
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.vendor !== undefined) patch.vendor = body.vendor ? String(body.vendor).trim() : null;
      if (body.invoiceDate !== undefined) patch.invoiceDate = body.invoiceDate ? String(body.invoiceDate).trim() : null;
      if (body.category !== undefined) patch.category = body.category || null;
      if (body.department !== undefined) patch.department = String(body.department).trim();
      if (body.total !== undefined) patch.total = Number(body.total);
      if (body.subtotal !== undefined) patch.subtotal = body.subtotal === '' ? null : Number(body.subtotal);
      if (body.tax !== undefined) patch.tax = body.tax === '' ? null : Number(body.tax);
      if (Array.isArray(body.items)) {
        patch.items = body.items
          .map((it: any) => ({ name: String(it.name ?? '').trim(), qty: Number(it.qty) || 0, price: Number(it.price) || 0 }))
          .filter((it: InvoiceItem) => it.name);
      }
    }

    const updated = await updateInvoice(id, patch as any);
    return NextResponse.json({ success: true, invoice: updated });
  } catch (e) {
    console.error('invoices PUT error', e);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل الفاتورة' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '', 10);
    if (isNaN(id)) return NextResponse.json({ error: 'معرّف الفاتورة غير صحيح' }, { status: 400 });

    const all = await getInvoices();
    const target = all.find((i) => i.id === id);
    if (!target) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 });

    const finance = isFinanceOrAdmin(supervisor.role);
    const owner = target.supervisorId === supervisor.id;
    if (!finance && !(owner && target.status === 'pending')) {
      return NextResponse.json({ error: 'غير مصرح لك بحذف هذه الفاتورة' }, { status: 403 });
    }

    const ok = await deleteInvoice(id);
    return NextResponse.json({ success: ok });
  } catch (e) {
    console.error('invoices DELETE error', e);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الفاتورة' }, { status: 500 });
  }
}
