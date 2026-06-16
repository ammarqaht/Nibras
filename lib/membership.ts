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
  hasCondition: boolean;
  conditionNote?: string | null;
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
  if (hasDatabase) {
    const prisma = getPrisma()!;
    // Create first to obtain the autoincrement id, then derive the membership number.
    const created = await prisma.registration.create({
      data: { ...input, membershipNo: 0 }
    });
    const membershipNo = membership.base + created.id;
    await prisma.registration.update({
      where: { id: created.id },
      data: { membershipNo }
    });
    return { membershipNo, mode: 'database' };
  }

  return localFallback(input);
}

/* ---------------- local run-now fallback ---------------- */

const DATA_DIR = path.join(process.cwd(), '.data');
const COUNTER_FILE = path.join(DATA_DIR, 'membership-counter.json');
const RECORDS_FILE = path.join(DATA_DIR, 'registrations.json');

async function localFallback(input: RegistrationInput): Promise<RegistrationResult> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  let count = 0;
  try {
    const raw = await fs.readFile(COUNTER_FILE, 'utf8');
    count = JSON.parse(raw).count ?? 0;
  } catch {
    count = 0;
  }
  count += 1;
  await fs.writeFile(COUNTER_FILE, JSON.stringify({ count }, null, 2), 'utf8');

  const membershipNo = membership.base + count;

  // Best-effort local record (not a substitute for a real DB).
  try {
    let records: unknown[] = [];
    try {
      records = JSON.parse(await fs.readFile(RECORDS_FILE, 'utf8'));
    } catch {
      records = [];
    }
    records.push({ membershipNo, ...input, createdAt: new Date().toISOString() });
    await fs.writeFile(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch {
    /* ignore local record write errors */
  }

  return { membershipNo, mode: 'local-fallback' };
}
