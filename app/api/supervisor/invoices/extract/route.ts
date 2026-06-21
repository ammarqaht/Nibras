import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Provider selection:
//  - If GEMINI_API_KEY (Google AI Studio, free tier) is set -> use Gemini.
//  - Else if ANTHROPIC_API_KEY is set -> use Claude.
//  - Else -> 503 (UI falls back to manual entry).
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.INVOICE_AI_MODEL || 'claude-opus-4-8';

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function parseDataUrl(input: string): { mediaType: MediaType; data: string } | null {
  const m = input.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/);
  if (m) return { mediaType: m[1] as MediaType, data: m[3] };
  if (/^[A-Za-z0-9+/=\s]+$/.test(input) && input.length > 100) {
    return { mediaType: 'image/jpeg', data: input.replace(/\s/g, '') };
  }
  return null;
}

const PROMPT =
  'هذه صورة فاتورة/إيصال شراء. استخرج البنود (الاسم، الكمية، سعر الوحدة) والمجاميع والإجمالي بدقة. ' +
  'الأسعار أرقام فقط بدون رموز عملة. إن لم تجد قيمة معيّنة اتركها فارغة. أعطِ النتيجة بصيغة JSON فقط.';

function normalize(out: any) {
  const items = Array.isArray(out?.items)
    ? out.items.map((it: any) => ({
        name: String(it?.name ?? '').trim(),
        qty: Number(it?.qty) || 1,
        price: Number(it?.price) || 0
      }))
    : [];
  return {
    title: out?.title ? String(out.title) : '',
    vendor: out?.vendor ? String(out.vendor) : '',
    invoiceDate: out?.invoiceDate ? String(out.invoiceDate) : '',
    currency: out?.currency ? String(out.currency) : 'SAR',
    items,
    subtotal: out?.subtotal != null ? Number(out.subtotal) : null,
    tax: out?.tax != null ? Number(out.tax) : null,
    total: out?.total != null ? Number(out.total) : items.reduce((s: number, i: any) => s + i.qty * i.price, 0),
    confidence: out?.confidence != null ? Number(out.confidence) : null
  };
}

/* -------------------- Gemini (Google AI Studio) -------------------- */
async function extractWithGemini(mediaType: string, data: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: mediaType, data } },
          { text: PROMPT }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          vendor: { type: 'STRING' },
          invoiceDate: { type: 'STRING' },
          currency: { type: 'STRING' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                qty: { type: 'NUMBER' },
                price: { type: 'NUMBER' }
              },
              required: ['name', 'qty', 'price']
            }
          },
          subtotal: { type: 'NUMBER' },
          tax: { type: 'NUMBER' },
          total: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' }
        },
        required: ['items', 'total']
      }
    }
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`gemini ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  return normalize(JSON.parse(text));
}

/* -------------------- Claude (Anthropic) — optional fallback -------------------- */
async function extractWithClaude(mediaType: MediaType, data: string) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    tools: [
      {
        name: 'record_invoice',
        description: 'سجّل البيانات المستخرجة من صورة الفاتورة.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' }, vendor: { type: 'string' }, invoiceDate: { type: 'string' },
            currency: { type: 'string' },
            items: {
              type: 'array',
              items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } }, required: ['name', 'qty', 'price'] }
            },
            subtotal: { type: 'number' }, tax: { type: 'number' }, total: { type: 'number' }, confidence: { type: 'number' }
          },
          required: ['items', 'total']
        }
      }
    ],
    tool_choice: { type: 'tool', name: 'record_invoice' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: PROMPT }
        ]
      }
    ]
  });
  const tool = message.content.find((b: any) => b.type === 'tool_use') as any;
  if (!tool) throw new Error('no tool_use');
  return normalize(tool.input);
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

  if (!GEMINI_KEY && !ANTHROPIC_KEY) {
    return NextResponse.json(
      { error: 'قراءة الفواتير بالذكاء الاصطناعي غير مفعّلة. أضف GEMINI_API_KEY (مجاني) أو أدخل الفاتورة يدوياً.', code: 'no_ai' },
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
    const data = GEMINI_KEY
      ? await extractWithGemini(parsed.mediaType, parsed.data)
      : await extractWithClaude(parsed.mediaType, parsed.data);
    return NextResponse.json({ success: true, data, provider: GEMINI_KEY ? 'gemini' : 'claude' });
  } catch (e: any) {
    console.error('invoice extract error', e?.message || e);
    return NextResponse.json(
      { error: 'تعذّر تحليل الفاتورة بالذكاء الاصطناعي. يمكنك إدخالها يدوياً.' },
      { status: 502 }
    );
  }
}
