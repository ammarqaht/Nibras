import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Model is overridable via env so you can switch to a cheaper model (e.g.
// claude-sonnet-4-6) without touching code. Default: most accurate.
const MODEL = process.env.INVOICE_AI_MODEL || 'claude-opus-4-8';

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function parseDataUrl(input: string): { mediaType: MediaType; data: string } | null {
  const m = input.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/);
  if (m) return { mediaType: m[1] as MediaType, data: m[3] };
  // raw base64 (assume jpeg, the client compresses to jpeg)
  if (/^[A-Za-z0-9+/=\s]+$/.test(input) && input.length > 100) {
    return { mediaType: 'image/jpeg', data: input.replace(/\s/g, '') };
  }
  return null;
}

const INVOICE_TOOL = {
  name: 'record_invoice',
  description: 'سجّل البيانات المستخرجة من صورة الفاتورة/الإيصال بدقة.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'وصف مختصر للفاتورة، مثلاً: مشتريات قرطاسية' },
      vendor: { type: 'string', description: 'اسم المتجر أو المورّد' },
      invoiceDate: { type: 'string', description: 'تاريخ الفاتورة كما هو مكتوب عليها' },
      currency: { type: 'string', description: 'العملة، مثل SAR' },
      items: {
        type: 'array',
        description: 'بنود الفاتورة',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'اسم المنتج/البند' },
            qty: { type: 'number', description: 'الكمية' },
            price: { type: 'number', description: 'سعر الوحدة بالأرقام' }
          },
          required: ['name', 'qty', 'price']
        }
      },
      subtotal: { type: 'number', description: 'المجموع قبل الضريبة' },
      tax: { type: 'number', description: 'قيمة الضريبة' },
      total: { type: 'number', description: 'الإجمالي النهائي' },
      confidence: { type: 'number', description: 'درجة الثقة في الاستخراج من 0 إلى 1' }
    },
    required: ['items', 'total']
  }
};

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // AI not configured — let the UI fall back to manual entry.
    return NextResponse.json(
      { error: 'قراءة الفواتير بالذكاء الاصطناعي غير مفعّلة. أضف ANTHROPIC_API_KEY أو أدخل الفاتورة يدوياً.', code: 'no_ai' },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 });
  }

  const parsed = parseDataUrl(String(body.imageBase64 || body.imageData || ''));
  if (!parsed) return NextResponse.json({ error: 'صورة غير صالحة' }, { status: 400 });

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      tools: [INVOICE_TOOL],
      tool_choice: { type: 'tool', name: 'record_invoice' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data }
            },
            {
              type: 'text',
              text:
                'هذه صورة فاتورة/إيصال شراء. استخرج البنود (الاسم، الكمية، سعر الوحدة) والمجاميع والإجمالي بدقة. ' +
                'الأسعار أرقام فقط بدون رموز عملة. إن لم تجد قيمة معيّنة اتركها فارغة. استدعِ أداة record_invoice بالنتيجة.'
            }
          ]
        }
      ]
    });

    const toolBlock = message.content.find(
      (b: any) => b.type === 'tool_use' && b.name === 'record_invoice'
    ) as any;

    if (!toolBlock) {
      return NextResponse.json({ error: 'تعذّر قراءة الفاتورة، حاول بصورة أوضح أو أدخلها يدوياً.' }, { status: 422 });
    }

    const out = toolBlock.input || {};
    const items = Array.isArray(out.items)
      ? out.items.map((it: any) => ({
          name: String(it.name ?? '').trim(),
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0
        }))
      : [];

    return NextResponse.json({
      success: true,
      data: {
        title: out.title ? String(out.title) : '',
        vendor: out.vendor ? String(out.vendor) : '',
        invoiceDate: out.invoiceDate ? String(out.invoiceDate) : '',
        currency: out.currency ? String(out.currency) : 'SAR',
        items,
        subtotal: out.subtotal != null ? Number(out.subtotal) : null,
        tax: out.tax != null ? Number(out.tax) : null,
        total: out.total != null ? Number(out.total) : items.reduce((s: number, i: any) => s + i.qty * i.price, 0),
        confidence: out.confidence != null ? Number(out.confidence) : null
      }
    });
  } catch (e: any) {
    console.error('invoice extract error', e?.message || e);
    return NextResponse.json(
      { error: 'تعذّر تحليل الفاتورة بالذكاء الاصطناعي. يمكنك إدخالها يدوياً.' },
      { status: 502 }
    );
  }
}
