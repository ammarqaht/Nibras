import { NextResponse } from 'next/server';
import { createRegistration } from '@/lib/membership';
import { stages } from '@/content';

export const runtime = 'nodejs';

function digitsOnly(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\D/g, '') : '';
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 });
  }

  const studentName = String(body.studentName ?? '').trim();
  const nationalId = digitsOnly(body.nationalId);
  const guardianPhone = digitsOnly(body.guardianPhone);
  const studentPhoneRaw = digitsOnly(body.studentPhone);
  const stage = String(body.stage ?? '').trim();
  const grade = String(body.grade ?? '').trim();
  const neighborhood = String(body.neighborhood ?? '').trim();
  const hasCondition = body.hasCondition === true || body.hasCondition === 'نعم';
  const conditionNote = String(body.conditionNote ?? '').trim();

  // ---- server-side validation (mirrors the client) ----
  if (studentName.split(/\s+/).filter(Boolean).length < 4)
    return NextResponse.json({ error: 'يرجى إدخال الاسم الرباعي كاملاً' }, { status: 400 });
  if (nationalId.length !== 10)
    return NextResponse.json({ error: 'رقم الهوية يجب أن يتكوّن من 10 أرقام' }, { status: 400 });
  if (guardianPhone.length < 10)
    return NextResponse.json({ error: 'رقم جوال ولي الأمر غير صحيح' }, { status: 400 });

  const stageDef = stages.find((s) => s.key === stage);
  if (!stageDef || !stageDef.grades.includes(grade as never))
    return NextResponse.json({ error: 'يرجى اختيار المرحلة والصف' }, { status: 400 });

  if (!neighborhood)
    return NextResponse.json({ error: 'يرجى إدخال الحي السكني' }, { status: 400 });
  if (hasCondition && !conditionNote)
    return NextResponse.json({ error: 'يرجى توضيح نوع الحساسية أو المرض' }, { status: 400 });

  const lat = typeof body.locationLat === 'number' ? body.locationLat : null;
  const lng = typeof body.locationLng === 'number' ? body.locationLng : null;
  const mapLink = String(body.mapLink ?? '').trim();

  if (!lat && !lng && !mapLink) {
    return NextResponse.json({ error: 'يرجى تحديد الموقع على الخريطة أو إدخال رابط قوقل ماب' }, { status: 400 });
  }

  const paymentType = String(body.paymentType ?? 'later').trim();
  const paymentReceipt = typeof body.paymentReceipt === 'string' ? body.paymentReceipt : null;

  if (paymentType === 'now' && !paymentReceipt) {
    return NextResponse.json({ error: 'يرجى رفع صورة إيصال التحويل البنكي' }, { status: 400 });
  }

  try {
    const result = await createRegistration({
      studentName,
      nationalId,
      guardianPhone,
      studentPhone: studentPhoneRaw || null,
      stage,
      grade,
      neighborhood,
      locationLat: lat,
      locationLng: lng,
      mapLink: mapLink || null,
      hasCondition,
      conditionNote: hasCondition ? conditionNote : null,
      paymentType,
      paymentReceipt
    });

    return NextResponse.json({ membershipNo: result.membershipNo, mode: result.mode });
  } catch (e) {
    console.error('register error', e);
    return NextResponse.json({ error: 'تعذّر إتمام التسجيل، حاول مرة أخرى' }, { status: 500 });
  }
}
