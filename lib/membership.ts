import { promises as fs } from 'fs';
import path from 'path';
import { getPrisma, hasDatabase } from '@/lib/db';
import { membership } from '@/content';

export type RegistrationInput = {
  studentName: string;
  nationalId: string;
  guardianPhone: string;
  studentPhone?: string | null;
  stage: string;
  grade: string;
  neighborhood: string;
  locationLat?: number | null;
  locationLng?: number | null;
  mapLink?: string | null;
  hasCondition: boolean;
  conditionNote?: string | null;
  paymentType?: string;
  paymentReceipt?: string | null;
};

export type RegistrationResult = {
  membershipNo: number;
  mode: 'database' | 'local-fallback';
};

/**
 * Persist a registration and return a unique, incrementing membership number.
 *
 *  - If DATABASE_URL is configured -> persist via Prisma; membershipNo = base + id.
 *  - Otherwise (run-now fallback)   -> increment a local JSON counter and append
 *    the registration to .data/registrations.json.
 *
 * TODO (data layer): the local fallback is for local development only. Configure
 * DATABASE_URL / DIRECT_URL + `npm run db:push` to enable real persistence.
 */
export async function createRegistration(input: RegistrationInput): Promise<RegistrationResult> {
  let useDb = hasDatabase;
  if (useDb) {
    try {
      const prisma = getPrisma()!;
      let membershipNo: number | null = null;

      // Try up to 5 times in case of concurrent registration race conditions
      for (let attempt = 0; attempt < 5; attempt++) {
        const registrations = await prisma.registration.findMany({
          select: { membershipNo: true },
          orderBy: { membershipNo: 'asc' }
        });

        const usedNos = new Set(registrations.map(r => r.membershipNo));
        let candidate = membership.base + 1;
        while (usedNos.has(candidate)) {
          candidate++;
        }

        try {
          const created = await prisma.registration.create({
            data: { ...input, membershipNo: candidate }
          });
          membershipNo = created.membershipNo;
          break; // success!
        } catch (err: any) {
          // Check if it's a unique constraint failure on membershipNo (Prisma error code P2002)
          if (err.code === 'P2002' && (err.meta?.target?.includes('membershipNo') || err.message?.includes('membershipNo'))) {
            console.warn(`Conflict on membershipNo ${candidate}, retrying...`);
            continue;
          }
          throw err; // rethrow other errors
        }
      }

      if (!membershipNo) {
        throw new Error("Failed to allocate a unique membership number after multiple attempts.");
      }

      return { membershipNo, mode: 'database' };
    } catch (dbErr) {
      console.error("Database registration failed, falling back to JSON:", dbErr);
      useDb = false;
    }
  }

  return localFallback(input);
}

/* ---------------- local run-now fallback ---------------- */

const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const DATA_DIR = isVercel ? '/tmp' : path.join(process.cwd(), '.data');
const COUNTER_FILE = path.join(DATA_DIR, 'membership-counter.json');
const RECORDS_FILE = path.join(DATA_DIR, 'registrations.json');

async function localFallback(input: RegistrationInput): Promise<RegistrationResult> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}

  let records: any[] = [];
  try {
    const raw = await fs.readFile(RECORDS_FILE, 'utf8');
    records = JSON.parse(raw);
    if (!Array.isArray(records)) {
      records = [];
    }
  } catch {
    records = [];
  }

  const usedNos = new Set<number>();
  for (const r of records) {
    if (r && typeof r.membershipNo === 'number') {
      usedNos.add(r.membershipNo);
    }
  }

  let candidate = membership.base + 1;
  while (usedNos.has(candidate)) {
    candidate++;
  }

  const membershipNo = candidate;

  // Best-effort local record (not a substitute for a real DB).
  try {
    records.push({ membershipNo, ...input, createdAt: new Date().toISOString() });
    await fs.writeFile(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch {
    /* ignore local record write errors */
  }

  // Maintain counter file for backwards compatibility
  try {
    await fs.writeFile(COUNTER_FILE, JSON.stringify({ count: candidate - membership.base }, null, 2), 'utf8');
  } catch {}

  return { membershipNo, mode: 'local-fallback' };
}
