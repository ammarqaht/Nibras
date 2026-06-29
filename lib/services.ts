import { promises as fs } from 'fs';
import path from 'path';
import { getPrisma, hasDatabase, disableDatabase } from './db';
import crypto from 'crypto';
import { INVOICE_BASE } from './finance';

// Mutable flag that lets us fallback to JSON if Prisma DB throws any connection/schema errors
let databaseAvailable = hasDatabase;

export type SupervisorInfo = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  groupIds: string;
  departments?: string;
  customPermissions?: string | null;
  stage?: string;
  passwordPlain?: string; // write-only mirror; never read back into API/UI
  createdAt: string;
};

export type InvoiceItem = { name: string; qty: number; price: number };

export type InvoiceInfo = {
  id: number;
  invoiceNo: number;
  title: string;
  vendor: string | null;
  invoiceDate: string | null;
  category: string | null;
  department: string;
  supervisorId: number;
  supervisorName: string;
  groupId: number | null;
  items: InvoiceItem[];
  subtotal: number | null;
  tax: number | null;
  total: number;
  currency: string;
  imageData: string | null;
  entryMode: string;
  aiExtracted: boolean;
  aiConfidence: number | null;
  status: string;
  settlement: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type StudentInfo = {
  id: number;
  membershipNo: number;
  studentName: string;
  nationalId: string;
  guardianPhone: string;
  studentPhone: string | null;
  stage: string;
  grade: string;
  neighborhood: string;
  locationLat: number | null;
  locationLng: number | null;
  mapLink: string | null;
  hasCondition: boolean;
  conditionNote: string | null;
  createdAt: string;
  paymentStatus: string;
  groupId: number | null;
  registrationStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
};

export type AttendanceInfo = {
  id: number;
  registrationId: number;
  date: string;
  status: string; // 'present' | 'absent' | 'late'
  recordedBy: string | null;
  createdAt: string;
};

export type PointInfo = {
  id: number;
  registrationId: number;
  delta: number;
  reason: string;
  category: string;
  pointType: 'individual' | 'collective' | 'deduction'; // individual=حضور+مهام, collective=لجان, deduction=خصم من الرصيد
  recordedBy: string | null;
  createdAt: string;
};

export type GroupInfo = {
  id: number;
  name: string;
  stage: string;
  createdAt: string;
};

export type AnnouncementInfo = {
  id: number;
  title: string;
  body: string;
  audience: string;
  imageUrl?: string | null;
  images?: string | null;
  createdAt: string;
};

export type SettingInfo = {
  key: string;
  value: string; // JSON string
};

// ==================== ROLE CONSTANTS ====================

export const FULL_STUDENT_DATA_ROLES = [
  'admin', 'finance', 'finance_supervisor',
  'general_supervisor', 'media_officer', 'stage_supervisor'
];

/** الأدوار التي تستطيع رؤية البيانات المالية في الإحصائيات */
export const FINANCE_ANALYTICS_ROLES = [
  'admin', 'finance', 'finance_supervisor'
];

/** الأدوار التي تستطيع إضافة نقاط جماعية للمجموعات */
export const GROUP_POINTS_ROLES = [
  'admin', 'cultural_supervisor', 'sports_supervisor',
  'scientific_supervisor', 'social_supervisor', 'stage_supervisor'
];

export const GLOBAL_ROLES = [
  'admin', 'finance', 'finance_supervisor',
  'media_supervisor', 'media_officer',
  'general_supervisor', 'attendance_supervisor',
  'cultural_supervisor', 'sports_supervisor',
  'scientific_supervisor', 'social_supervisor',
  'tasks_supervisor'
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  attendance_supervisor: ['attendance', 'students', 'analytics', 'points'],
  social_supervisor: ['points', 'students', 'groups', 'schedule', 'analytics'],
  cultural_supervisor: ['points', 'students', 'groups', 'schedule', 'analytics'],
  scientific_supervisor: ['points', 'students', 'groups', 'schedule', 'analytics'],
  sports_supervisor: ['points', 'students', 'groups', 'schedule', 'analytics'],
  groups_supervisor: ['groups', 'students', 'points', 'attendance', 'analytics'],
  general_supervisor: ['students', 'analytics', 'invoices', 'groups', 'attendance', 'points'],
  media_supervisor: ['announcements', 'schedule', 'students', 'analytics', 'points'],
  stage_supervisor: ['groups', 'students', 'points', 'attendance', 'analytics'],
  tasks_supervisor: ['tasks', 'students', 'analytics'],
};

/**
 * Calculates the three-part point summary for a student or set of points.
 * individual = committee positive points (مشاركة / سلوك / متجر / أخرى)
 * collective = group committee additions (مسابقة / رياضي / اجتماعي / علمي)
 * deduction  = deducted from balance only (never counts toward ranking)
 * balance    = max(0, individual + collective + deduction)
 * rankScore  = individual + collective (leaderboard ranking)
 */
export function calcPointSummary(points: PointInfo[]): {
  individual: number; collective: number; deduction: number; balance: number; rankScore: number;
} {
  let individual = 0, collective = 0, deduction = 0;
  for (const p of points) {
    const t = p.pointType ?? (
      p.reason.endsWith('(رصد جماعي للأسرة)') ? 'collective' : p.delta < 0 ? 'deduction' : 'individual'
    );
    if (t === 'individual') individual += p.delta;
    else if (t === 'collective') collective += p.delta;
    else deduction += p.delta;
  }
  return {
    individual, collective, deduction,
    balance: Math.max(0, individual + collective + deduction),
    rankScore: individual + collective,
  };
}

/**
 * Resolves the set of group IDs a supervisor may access.
 * - Explicit groupIds (used by مشرف أسر / groups_supervisor).
 * - For مشرف مرحلة / stage_supervisor: every group whose stage matches the
 *   supervisor's stage (resolved dynamically so groups added later are included).
 */
export function getAccessibleGroupIds(
  supervisor: { role: string; groupIds: string; stage?: string | null },
  groups: { id: number; stage: string }[]
): number[] {
  const roles = supervisor.role.split(',').map((r) => r.trim());
  const ids = new Set<number>(
    supervisor.groupIds.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  );
  if (roles.includes('stage_supervisor') && supervisor.stage) {
    for (const g of groups) {
      if (g.stage === supervisor.stage) ids.add(g.id);
    }
  }
  return Array.from(ids);
}

export type ScheduleInfo = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  supervisorId: number;
  stage: string;
  notes?: string | null;
  createdAt: string;
};

// Standard SHA256 hashing for secure passwords without extra dependencies
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Local fallback files paths
const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const DATA_DIR = isVercel ? '/tmp' : path.join(process.cwd(), '.data');
const FILE_REGISTRATIONS = path.join(DATA_DIR, 'registrations.json');
const FILE_SUPERVISORS = path.join(DATA_DIR, 'supervisors.json');
const FILE_ATTENDANCE = path.join(DATA_DIR, 'attendance.json');
const FILE_POINTS = path.join(DATA_DIR, 'points.json');
const FILE_GROUPS = path.join(DATA_DIR, 'groups.json');
const FILE_ANNOUNCEMENTS = path.join(DATA_DIR, 'announcements.json');
const FILE_SETTINGS = path.join(DATA_DIR, 'settings.json');
const FILE_INVOICES = path.join(DATA_DIR, 'invoices.json');
const FILE_TASKS = path.join(DATA_DIR, 'tasks.json');
const FILE_SUBMISSIONS = path.join(DATA_DIR, 'submissions.json');
const FILE_SCHEDULES = path.join(DATA_DIR, 'schedules.json');
const FILE_GENERAL_EXPENSES = path.join(DATA_DIR, 'general_expenses.json');
const FILE_OTHER_REVENUES = path.join(DATA_DIR, 'other_revenues.json');
const FILE_SPORT_LEAGUES = path.join(DATA_DIR, 'sport_leagues.json');
const FILE_SPORT_MATCHES = path.join(DATA_DIR, 'sport_matches.json');
const FILE_SPORT_GOALS = path.join(DATA_DIR, 'sport_goals.json');
const FILE_SPORT_CARDS = path.join(DATA_DIR, 'sport_cards.json');
const FILE_SPORT_BEHAVIORS = path.join(DATA_DIR, 'sport_behaviors.json');

async function readJsonFile<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn(`Could not write json file to ${filePath} (read-only filesystem fallback):`, err);
  }
}

// Ensure default Admin supervisor is seeded
export async function seedDefaultAdminIfNeeded(): Promise<void> {
  const defaultHash = hashPassword('12345');
  const isDev = process.env.NODE_ENV !== 'production';

  const devAccounts = isDev ? [
    { email: '1', role: 'admin', name: 'تجربة مدير عام' },
    { email: '2', role: 'finance', name: 'تجربة مسؤول مالية' },
    { email: '3', role: 'attendance_supervisor', name: 'تجربة مشرف تحضير' },
    { email: '4', role: 'social_supervisor', name: 'تجربة مشرف اجتماعية' },
    { email: '5', role: 'cultural_supervisor', name: 'تجربة مشرف ثقافية' },
    { email: '6', role: 'groups_supervisor', name: 'تجربة مشرف أسر' },
    { email: '7', role: 'general_supervisor', name: 'تجربة مشرف عام' },
    { email: '8', role: 'media_supervisor', name: 'تجربة مشرف إعلامية' },
    { email: '9', role: 'scientific_supervisor', name: 'تجربة مشرف علمية' },
    { email: '10', role: 'sports_supervisor', name: 'تجربة مشرف رياضية' },
    { email: '11', role: 'stage_supervisor', name: 'تجربة مشرف مرحلة' },
    { email: '12', role: 'tasks_supervisor', name: 'تجربة مشرف مهام' },
  ] : [];
  const devHash = hashPassword('a');

  if (databaseAvailable) {
    try {
      const prisma = getPrisma()!;

      await prisma.supervisor.upsert({
        where: { email: 'admin' },
        update: { passwordHash: defaultHash, role: 'admin', name: 'المدير العام' },
        create: { name: 'المدير العام', email: 'admin', passwordHash: defaultHash, role: 'admin', groupIds: '' }
      });

      for (const d of devAccounts) {
        await prisma.supervisor.upsert({
          where: { email: d.email },
          update: { passwordHash: devHash, role: d.role, name: d.name, passwordPlain: 'a' },
          create: { name: d.name, email: d.email, passwordHash: devHash, role: d.role, groupIds: '', departments: '', stage: '', passwordPlain: 'a' }
        });
      }
    } catch (err) {
      console.error("Database seed failed, disabling DB client and falling back to JSON:", err);
      databaseAvailable = false;
      disableDatabase();
    }
  }

  if (!databaseAvailable) {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);

    const upsertJson = (email: string, role: string, name: string, hash: string, defaultStage = '', defaultGroupIds = '') => {
      const idx = supervisors.findIndex(s => s.email === email);
      if (idx !== -1) {
        supervisors[idx].passwordHash = hash;
        supervisors[idx].role = role;
        // Do not overwrite groupIds or stage if they already exist
      }
      else {
        supervisors.push({
          id: supervisors.length > 0 ? Math.max(...supervisors.map(s => s.id)) + 1 : 1,
          name,
          email,
          passwordHash: hash,
          role,
          groupIds: defaultGroupIds,
          departments: '',
          stage: defaultStage,
          createdAt: new Date().toISOString()
        });
      }
    };

    upsertJson('admin', 'admin', 'المدير العام', defaultHash);
    for (const d of devAccounts) {
      upsertJson(
        d.email,
        d.role,
        d.name,
        devHash,
        d.role === 'stage_supervisor' ? 'ابتدائي' : '',
        d.role === 'groups_supervisor' ? '1' : ''
      );
    }

    await writeJsonFile(FILE_SUPERVISORS, supervisors);
  }
}

// ==================== SUPERVISOR SERVICES ====================
export async function getSupervisorByEmail(email: string): Promise<SupervisorInfo | null> {
  await seedDefaultAdminIfNeeded();
  if (databaseAvailable) {
    try {
      const prisma = getPrisma()!;
      const sup = await prisma.supervisor.findUnique({ where: { email } });
      if (!sup) return null;
      return {
        id: sup.id,
        name: sup.name,
        email: sup.email,
        passwordHash: sup.passwordHash,
        role: sup.role,
        groupIds: sup.groupIds,
        departments: sup.departments,
        customPermissions: sup.customPermissions,
        stage: sup.stage,
        createdAt: sup.createdAt.toISOString()
      };
    } catch (err) {
      console.error("Database query failed, falling back to JSON:", err);
      databaseAvailable = false;
      disableDatabase();
    }
  }

  if (!databaseAvailable) {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    return supervisors.find(s => s.email === email) || null;
  }
  return null;
}

export async function getAllSupervisors(): Promise<SupervisorInfo[]> {
  await seedDefaultAdminIfNeeded();
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.supervisor.findMany();
    return list.map(sup => ({
      id: sup.id,
      name: sup.name,
      email: sup.email,
      passwordHash: sup.passwordHash,
      role: sup.role,
      groupIds: sup.groupIds,
      departments: sup.departments,
      customPermissions: sup.customPermissions,
      stage: sup.stage,
      createdAt: sup.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
  }
}

export async function createSupervisor(data: Omit<SupervisorInfo, 'id' | 'createdAt'>): Promise<SupervisorInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const sup = await prisma.supervisor.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        groupIds: data.groupIds,
        departments: data.departments,
        customPermissions: data.customPermissions,
        stage: data.stage,
        passwordPlain: data.passwordPlain ?? ''
      }
    });
    return {
      id: sup.id,
      name: sup.name,
      email: sup.email,
      passwordHash: sup.passwordHash,
      role: sup.role,
      groupIds: sup.groupIds,
      departments: sup.departments,
      customPermissions: sup.customPermissions,
      stage: sup.stage,
      createdAt: sup.createdAt.toISOString()
    };
  } else {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    const newSup: SupervisorInfo = {
      id: supervisors.length > 0 ? Math.max(...supervisors.map(s => s.id)) + 1 : 1,
      ...data,
      createdAt: new Date().toISOString()
    };
    supervisors.push(newSup);
    await writeJsonFile(FILE_SUPERVISORS, supervisors);
    return newSup;
  }
}

export async function deleteSupervisor(id: number): Promise<boolean> {
  if (hasDatabase) {
    try {
      const prisma = getPrisma()!;
      await prisma.supervisor.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    const index = supervisors.findIndex(s => s.id === id);
    if (index === -1) return false;
    supervisors.splice(index, 1);
    await writeJsonFile(FILE_SUPERVISORS, supervisors);
    return true;
  }
}

export async function updateSupervisor(
  id: number,
  data: Partial<Omit<SupervisorInfo, 'id' | 'createdAt'>> & { password?: string }
): Promise<SupervisorInfo | null> {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.groupIds !== undefined) updateData.groupIds = data.groupIds;
  if (data.departments !== undefined) updateData.departments = data.departments;
  if (data.customPermissions !== undefined) updateData.customPermissions = data.customPermissions;
  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.password) {
    updateData.passwordHash = hashPassword(data.password);
    updateData.passwordPlain = data.password;
  }

  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const updated = await prisma.supervisor.update({
        where: { id },
        data: updateData
      });
      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        passwordHash: updated.passwordHash,
        role: updated.role,
        groupIds: updated.groupIds,
        departments: updated.departments,
        customPermissions: updated.customPermissions,
        stage: updated.stage,
        createdAt: updated.createdAt.toISOString()
      };
    } catch {
      return null;
    }
  } else {
    const list = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return null;

    const updated = { ...list[index] };
    if (updateData.name !== undefined) updated.name = updateData.name;
    if (updateData.email !== undefined) updated.email = updateData.email;
    if (updateData.role !== undefined) updated.role = updateData.role;
    if (updateData.groupIds !== undefined) updated.groupIds = updateData.groupIds;
    if (updateData.departments !== undefined) updated.departments = updateData.departments;
    if (updateData.passwordHash !== undefined) updated.passwordHash = updateData.passwordHash;
    if (updateData.stage !== undefined) updated.stage = updateData.stage;

    list[index] = updated;
    await writeJsonFile(FILE_SUPERVISORS, list);
    return updated;
  }
}

// ==================== STUDENT / REGISTRATION SERVICES ====================
export async function getStudents(): Promise<StudentInfo[]> {
  if (hasDatabase) {
    try {
      const prisma = getPrisma()!;
      const list = await prisma.registration.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return list.map(r => ({
        id: r.id,
        membershipNo: r.membershipNo,
        studentName: r.studentName,
        nationalId: r.nationalId,
        guardianPhone: r.guardianPhone,
        studentPhone: r.studentPhone,
        stage: r.stage,
        grade: r.grade,
        neighborhood: r.neighborhood,
        locationLat: r.locationLat,
        locationLng: r.locationLng,
        mapLink: r.mapLink,
        hasCondition: r.hasCondition,
        conditionNote: r.conditionNote,
        createdAt: r.createdAt.toISOString(),
        paymentStatus: r.paymentStatus,
        groupId: r.groupId,
        registrationStatus: r.registrationStatus,
        paymentType: r.paymentType,
        paymentReceipt: r.paymentReceipt
      }));
    } catch (err) {
      console.error("Database query failed in getStudents, falling back to JSON:", err);
      disableDatabase();
    }
  }

  const list = await readJsonFile<any[]>(FILE_REGISTRATIONS, []);
  return list.map((r, index) => ({
    id: r.id || index + 1,
    membershipNo: r.membershipNo,
    studentName: r.studentName,
    nationalId: r.nationalId,
    guardianPhone: r.guardianPhone,
    studentPhone: r.studentPhone || null,
    stage: r.stage,
    grade: r.grade,
    neighborhood: r.neighborhood,
    locationLat: r.locationLat ?? null,
    locationLng: r.locationLng ?? null,
    mapLink: r.mapLink || null,
    hasCondition: !!r.hasCondition,
    conditionNote: r.conditionNote || null,
    createdAt: r.createdAt || new Date().toISOString(),
    paymentStatus: r.paymentStatus || 'unpaid',
    groupId: r.groupId ?? null,
    registrationStatus: r.registrationStatus || 'pending',
    paymentType: r.paymentType || 'later',
    paymentReceipt: r.paymentReceipt || null
  }));
}

export async function updateStudent(id: number, data: Partial<Omit<StudentInfo, 'id' | 'membershipNo'>>): Promise<StudentInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        studentName: data.studentName,
        nationalId: data.nationalId,
        guardianPhone: data.guardianPhone,
        studentPhone: data.studentPhone,
        stage: data.stage,
        grade: data.grade,
        neighborhood: data.neighborhood,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        mapLink: data.mapLink,
        hasCondition: data.hasCondition,
        conditionNote: data.conditionNote,
        paymentStatus: data.paymentStatus,
        groupId: data.groupId,
        registrationStatus: data.registrationStatus,
        paymentType: data.paymentType,
        paymentReceipt: data.paymentReceipt
      }
    });
    return {
      id: updated.id,
      membershipNo: updated.membershipNo,
      studentName: updated.studentName,
      nationalId: updated.nationalId,
      guardianPhone: updated.guardianPhone,
      studentPhone: updated.studentPhone,
      stage: updated.stage,
      grade: updated.grade,
      neighborhood: updated.neighborhood,
      locationLat: updated.locationLat,
      locationLng: updated.locationLng,
      mapLink: updated.mapLink,
      hasCondition: updated.hasCondition,
      conditionNote: updated.conditionNote,
      createdAt: updated.createdAt.toISOString(),
      paymentStatus: updated.paymentStatus,
      groupId: updated.groupId,
      registrationStatus: updated.registrationStatus,
      paymentType: updated.paymentType,
      paymentReceipt: updated.paymentReceipt
    };
  } else {
    const list = await getStudents();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return null;
    const updated = { ...list[index] };
    Object.keys(data).forEach(key => {
      const val = (data as any)[key];
      if (val !== undefined) {
        (updated as any)[key] = val;
      }
    });
    list[index] = updated;
    await writeJsonFile(FILE_REGISTRATIONS, list);
    return updated;
  }
}

// ==================== ATTENDANCE SERVICES ====================
export async function getAttendance(): Promise<AttendanceInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.attendance.findMany();
    return list.map(a => ({
      id: a.id,
      registrationId: a.registrationId,
      date: a.date,
      status: a.status,
      recordedBy: a.recordedBy,
      createdAt: a.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<AttendanceInfo[]>(FILE_ATTENDANCE, []);
  }
}

export async function logAttendance(registrationId: number, date: string, status: string, recordedBy: string): Promise<AttendanceInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    // Upsert equivalent: check if attendance for this student and date already exists
    const existing = await prisma.attendance.findFirst({
      where: { registrationId, date }
    });
    if (existing) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { status, recordedBy }
      });
      return {
        id: updated.id,
        registrationId: updated.registrationId,
        date: updated.date,
        status: updated.status,
        recordedBy: updated.recordedBy,
        createdAt: updated.createdAt.toISOString()
      };
    } else {
      const created = await prisma.attendance.create({
        data: { registrationId, date, status, recordedBy }
      });
      return {
        id: created.id,
        registrationId: created.registrationId,
        date: created.date,
        status: created.status,
        recordedBy: created.recordedBy,
        createdAt: created.createdAt.toISOString()
      };
    }
  } else {
    const list = await readJsonFile<AttendanceInfo[]>(FILE_ATTENDANCE, []);
    const existingIndex = list.findIndex(a => a.registrationId === registrationId && a.date === date);
    if (existingIndex !== -1) {
      list[existingIndex].status = status;
      list[existingIndex].recordedBy = recordedBy;
      await writeJsonFile(FILE_ATTENDANCE, list);
      return list[existingIndex];
    } else {
      const newRecord: AttendanceInfo = {
        id: list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1,
        registrationId,
        date,
        status,
        recordedBy,
        createdAt: new Date().toISOString()
      };
      list.push(newRecord);
      await writeJsonFile(FILE_ATTENDANCE, list);
      return newRecord;
    }
  }
}

export async function deleteAttendance(registrationId: number, date: string): Promise<void> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.attendance.deleteMany({ where: { registrationId, date } });
  } else {
    const list = await readJsonFile<AttendanceInfo[]>(FILE_ATTENDANCE, []);
    await writeJsonFile(FILE_ATTENDANCE, list.filter(a => !(a.registrationId === registrationId && a.date === date)));
  }
}

// ─── ATTENDANCE EXCUSES (طلبات عذر الغياب) — stored in settings JSON ───────────
export type AttendanceExcuse = {
  id: string; registrationId: number; studentName: string;
  date: string; reason: string; status: 'pending' | 'accepted' | 'rejected'; createdAt: string;
};

export async function getAttendanceExcuses(): Promise<AttendanceExcuse[]> {
  const raw = await getSetting('attendance_excuses');
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export async function addAttendanceExcuse(data: { registrationId: number; studentName: string; date: string; reason: string }): Promise<AttendanceExcuse> {
  const list = await getAttendanceExcuses();
  const dup = list.find(e => e.registrationId === data.registrationId && e.date === data.date && e.status === 'pending');
  if (dup) return dup;
  const crypto = await import('crypto');
  const rec: AttendanceExcuse = { id: crypto.randomUUID(), ...data, status: 'pending', createdAt: new Date().toISOString() };
  list.push(rec);
  await saveSetting('attendance_excuses', JSON.stringify(list));
  return rec;
}

export async function resolveAttendanceExcuse(id: string, accept: boolean, recordedBy: string): Promise<AttendanceExcuse | null> {
  const list = await getAttendanceExcuses();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) return null;
  list[idx].status = accept ? 'accepted' : 'rejected';
  await saveSetting('attendance_excuses', JSON.stringify(list));
  if (accept) {
    // Mark the student as excused for that day
    await logAttendance(list[idx].registrationId, list[idx].date, 'excused', recordedBy);
  }
  return list[idx];
}

// Delete attendance-linked point records for a student on a specific date.
// Points created by the attendance route embed the date as " | YYYY-MM-DD" in the reason.
export async function deleteAttendancePointsByDate(registrationId: number, date: string): Promise<void> {
  const dateSuffix = ` | ${date}`;
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await (prisma as any).point.deleteMany({
      where: {
        registrationId,
        category: 'attendance',
        reason: { endsWith: dateSuffix },
      },
    });
  } else {
    const list = await readJsonFile<PointInfo[]>(FILE_POINTS, []);
    await writeJsonFile(
      FILE_POINTS,
      list.filter(p => !(p.registrationId === registrationId && p.category === 'attendance' && p.reason.endsWith(dateSuffix)))
    );
  }
}

// ==================== POINTS SERVICES ====================
export async function getPoints(): Promise<PointInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.point.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return list.map(p => ({
      id: p.id,
      registrationId: p.registrationId,
      delta: p.delta,
      reason: p.reason,
      category: p.category,
      pointType: ((p as any).pointType as PointInfo['pointType']) ?? (
        p.reason.endsWith('(رصد جماعي للأسرة)') ? 'collective' : p.delta < 0 ? 'deduction' : 'individual'
      ),
      recordedBy: p.recordedBy,
      createdAt: p.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<PointInfo[]>(FILE_POINTS, []);
  }
}

export async function addPointsRecord(data: Omit<PointInfo, 'id' | 'createdAt'>): Promise<PointInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const p = await prisma.point.create({
      data: {
        registrationId: data.registrationId,
        delta: data.delta,
        reason: data.reason,
        category: data.category,
        pointType: data.pointType,
        recordedBy: data.recordedBy
      } as any
    });
    return {
      id: p.id,
      registrationId: p.registrationId,
      delta: p.delta,
      reason: p.reason,
      category: p.category,
      pointType: data.pointType,
      recordedBy: p.recordedBy,
      createdAt: p.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<PointInfo[]>(FILE_POINTS, []);
    const newRecord: PointInfo = {
      id: list.length > 0 ? Math.max(...list.map(p => p.id)) + 1 : 1,
      ...data,
      createdAt: new Date().toISOString()
    };
    list.push(newRecord);
    await writeJsonFile(FILE_POINTS, list);
    return newRecord;
  }
}

// ==================== GROUPS SERVICES ====================
export async function getGroups(): Promise<GroupInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.group.findMany();
    return list.map(g => ({
      id: g.id,
      name: g.name,
      stage: g.stage,
      createdAt: g.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<GroupInfo[]>(FILE_GROUPS, []);
  }
}

export async function createGroup(name: string, stage: string): Promise<GroupInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const g = await prisma.group.create({
      data: { name, stage }
    });
    return {
      id: g.id,
      name: g.name,
      stage: g.stage,
      createdAt: g.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<GroupInfo[]>(FILE_GROUPS, []);
    const newGroup: GroupInfo = {
      id: list.length > 0 ? Math.max(...list.map(g => g.id)) + 1 : 1,
      name,
      stage,
      createdAt: new Date().toISOString()
    };
    list.push(newGroup);
    await writeJsonFile(FILE_GROUPS, list);
    return newGroup;
  }
}

export async function deleteGroup(id: number): Promise<boolean> {
  if (hasDatabase) {
    try {
      const prisma = getPrisma()!;
      // Set groupId to null for students in this group
      await prisma.registration.updateMany({
        where: { groupId: id },
        data: { groupId: null }
      });

      // Remove group from supervisors
      const supervisorsWithGroup = await prisma.supervisor.findMany();
      for (const sup of supervisorsWithGroup) {
        if (sup.groupIds) {
          const ids = sup.groupIds.split(',').map(s => parseInt(s, 10)).filter(num => !isNaN(num));
          if (ids.includes(id)) {
            const newIds = ids.filter(gId => gId !== id).join(',');
            await prisma.supervisor.update({
              where: { id: sup.id },
              data: { groupIds: newIds }
            });
          }
        }
      }

      await prisma.group.delete({ where: { id } });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  } else {
    const list = await readJsonFile<GroupInfo[]>(FILE_GROUPS, []);
    const index = list.findIndex(g => g.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    await writeJsonFile(FILE_GROUPS, list);

    const students = await readJsonFile<any[]>(FILE_REGISTRATIONS, []);
    let studentsUpdated = false;
    for (const s of students) {
      if (s.groupId === id) {
        s.groupId = null;
        studentsUpdated = true;
      }
    }
    if (studentsUpdated) await writeJsonFile(FILE_REGISTRATIONS, students);

    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    let supervisorsUpdated = false;
    for (const s of supervisors) {
      if (s.groupIds) {
        const ids = s.groupIds.split(',').map((n: string) => parseInt(n, 10)).filter((num: number) => !isNaN(num));
        if (ids.includes(id)) {
          s.groupIds = ids.filter((gId: number) => gId !== id).join(',');
          supervisorsUpdated = true;
        }
      }
    }
    if (supervisorsUpdated) await writeJsonFile(FILE_SUPERVISORS, supervisors);

    return true;
  }
}

// ==================== ANNOUNCEMENTS SERVICES ====================
export async function getAnnouncements(): Promise<AnnouncementInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return list.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      imageUrl: a.imageUrl,
      images: a.images,
      createdAt: a.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<AnnouncementInfo[]>(FILE_ANNOUNCEMENTS, []);
  }
}

export async function createAnnouncement(title: string, body: string, audience: string, imageUrl?: string | null, images?: string | null): Promise<AnnouncementInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const a = await prisma.announcement.create({
      data: { title, body, audience, imageUrl, images }
    });
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      imageUrl: a.imageUrl,
      images: a.images,
      createdAt: a.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<AnnouncementInfo[]>(FILE_ANNOUNCEMENTS, []);
    const newAnnounce: AnnouncementInfo = {
      id: list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1,
      title,
      body,
      audience,
      imageUrl: imageUrl || null,
      images: images || null,
      createdAt: new Date().toISOString()
    };
    list.push(newAnnounce);
    await writeJsonFile(FILE_ANNOUNCEMENTS, list);
    return newAnnounce;
  }
}

export async function updateAnnouncement(id: number, patch: { title?: string; body?: string; audience?: string; imageUrl?: string | null; images?: string | null }): Promise<AnnouncementInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const a = await prisma.announcement.update({
      where: { id },
      data: {
        title: patch.title,
        body: patch.body,
        audience: patch.audience,
        imageUrl: patch.imageUrl,
        images: patch.images
      }
    });
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      imageUrl: a.imageUrl,
      images: a.images,
      createdAt: a.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<AnnouncementInfo[]>(FILE_ANNOUNCEMENTS, []);
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return null;

    const updated = {
      ...list[idx],
      ...patch,
    };
    list[idx] = updated;
    await writeJsonFile(FILE_ANNOUNCEMENTS, list);
    return updated;
  }
}

export async function deleteAnnouncement(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.announcement.delete({
      where: { id }
    });
    return true;
  } else {
    const list = await readJsonFile<AnnouncementInfo[]>(FILE_ANNOUNCEMENTS, []);
    const filtered = list.filter((a) => a.id !== id);
    if (filtered.length === list.length) return false;
    await writeJsonFile(FILE_ANNOUNCEMENTS, filtered);
    return true;
  }
}

// ==================== SETTINGS / CONFIG SYNC SERVICES ====================
export async function getSettings(): Promise<Record<string, string>> {
  if (hasDatabase) {
    try {
      const prisma = getPrisma()!;
      const list = await prisma.setting.findMany();
      const map: Record<string, string> = {};
      for (const item of list) {
        map[item.key] = item.value;
      }
      return map;
    } catch (err) {
      console.error("Database query failed in getSettings, falling back to JSON:", err);
      disableDatabase();
    }
  }
  return readJsonFile<Record<string, string>>(FILE_SETTINGS, {});
}

import { site as origSite, landing as origLanding, clubDetails as origClubDetails, footer as origFooter, defaultBankDetails as origDefaultBankDetails } from '../content';

export async function saveSetting(key: string, value: string): Promise<void> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  } else {
    const map = await readJsonFile<Record<string, string>>(FILE_SETTINGS, {});
    map[key] = value;
    await writeJsonFile(FILE_SETTINGS, map);
  }
}

export async function getMergedSettings() {
  const custom = await getSettings();

  const site = {
    ...origSite,
    nameAr: custom.siteNameAr || origSite.nameAr,
    nameEn: custom.siteNameEn || origSite.nameEn,
    clubNameAr: custom.clubNameAr || origSite.clubNameAr,
  };

  const landing = {
    ...origLanding,
    intro: custom.landingIntro || origLanding.intro,
    tagline: custom.landingTagline || origLanding.tagline,
    taglineSub: custom.landingTaglineSub || origLanding.taglineSub,
  };

  const clubDetails = {
    ...origClubDetails,
    targetGroup: {
      ...origClubDetails.targetGroup,
      value: custom.clubTargetGroupValue || origClubDetails.targetGroup.value,
    },
    dates: {
      ...origClubDetails.dates,
      value: custom.clubDatesValue || origClubDetails.dates.value,
    },
    time: {
      ...origClubDetails.time,
      value: custom.clubTimeValue || origClubDetails.time.value,
      note: custom.clubTimeNote || origClubDetails.time.note,
    },
    fees: {
      ...origClubDetails.fees,
      value: custom.clubFeesValue || origClubDetails.fees.value,
    },
    location: {
      ...origClubDetails.location,
      value: custom.clubLocationValue || origClubDetails.location.value,
      note: custom.clubLocationNote || origClubDetails.location.note,
      mapLinkSetting: custom.clubLocationMapLink || '',
      get mapsLink(): string {
        return this.mapLinkSetting || `https://www.google.com/maps?q=${origClubDetails.location.lat},${origClubDetails.location.lng}`;
      },
      get embedSrc(): string {
        const url = this.mapsLink;
        // Try to extract coordinates from standard google maps URL formats
        const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const queryRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(coordRegex) || url.match(queryRegex);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
        }
        return '';
      }
    }
  };

  const footer = {
    ...origFooter,
    tagline: custom.landingTagline || origFooter.tagline,
    social: origFooter.social.map(s => ({
      ...s,
      href: custom[`social_${s.key}`] || s.href
    }))
  };

  const bankDetails = {
    bankName: custom.bankName || origDefaultBankDetails.bankName,
    accountNumber: custom.bankAccount || origDefaultBankDetails.accountNumber,
    iban: custom.bankIban || origDefaultBankDetails.iban,
    accountOwner: custom.bankOwner || origDefaultBankDetails.accountOwner,
  };

  return { site, landing, clubDetails, footer, bankDetails };
}

export async function deleteStudent(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      // 1. Delete associated data first to keep database clean
      await prisma.submission.deleteMany({ where: { registrationId: id } });
      await prisma.point.deleteMany({ where: { registrationId: id } });
      await prisma.attendance.deleteMany({ where: { registrationId: id } });

      // 2. Delete student
      await prisma.registration.delete({ where: { id } });

      // 3. Reset the autoincrement sequence to prevent gaps when deleting last student
      const maxStudent = await prisma.registration.findFirst({
        orderBy: { id: 'desc' }
      });
      if (maxStudent) {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"Registration"', 'id'), ${maxStudent.id});`
        );
      } else {
        await prisma.$executeRawUnsafe(
          `ALTER SEQUENCE "Registration_id_seq" RESTART WITH 1;`
        );
      }

      return true;
    } catch (err) {
      console.error('Error deleting student from DB:', err);
      return false;
    }
  } else {
    // JSON Fallback mode
    const path = await import('path');
    const COUNTER_FILE = path.join(DATA_DIR, 'membership-counter.json');

    const registrations = await readJsonFile<any[]>(FILE_REGISTRATIONS, []);
    const index = registrations.findIndex(s => s.id === id);
    if (index === -1) return false;

    registrations.splice(index, 1);
    await writeJsonFile(FILE_REGISTRATIONS, registrations);

    // Clean up related JSON files
    const attendance = await readJsonFile<any[]>(FILE_ATTENDANCE, []);
    await writeJsonFile(FILE_ATTENDANCE, attendance.filter(a => a.registrationId !== id));

    const points = await readJsonFile<any[]>(FILE_POINTS, []);
    await writeJsonFile(FILE_POINTS, points.filter(p => p.registrationId !== id));

    const submissions = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    await writeJsonFile(FILE_SUBMISSIONS, submissions.filter(s => s.registrationId !== id));

    // Reset local counter to current max ID
    const maxId = registrations.length > 0 ? Math.max(...registrations.map(r => r.id)) : 0;
    await writeJsonFile(COUNTER_FILE, { count: maxId });

    return true;
  }
}

export async function createStudentManually(data: Omit<StudentInfo, 'id' | 'membershipNo' | 'createdAt'>): Promise<StudentInfo> {
  const { createRegistration } = await import('./membership');
  const result = await createRegistration({
    studentName: data.studentName,
    nationalId: data.nationalId,
    guardianPhone: data.guardianPhone,
    studentPhone: data.studentPhone,
    stage: data.stage,
    grade: data.grade,
    neighborhood: data.neighborhood,
    mapLink: data.mapLink,
    hasCondition: data.hasCondition,
    conditionNote: data.conditionNote
  });

  const students = await getStudents();
  const student = students.find(s => s.membershipNo === result.membershipNo);
  if (!student) throw new Error('Student creation failed');

  const updated = await updateStudent(student.id, {
    paymentStatus: data.paymentStatus,
    registrationStatus: data.registrationStatus,
    groupId: data.groupId
  });

  return updated!;
}

// ==================== INVOICE / FINANCE SERVICES ====================

function mapInvoiceRow(r: any): InvoiceInfo {
  let items: InvoiceItem[] = [];
  try {
    items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [];
  } catch {
    items = [];
  }
  return {
    id: r.id,
    invoiceNo: r.invoiceNo,
    title: r.title,
    vendor: r.vendor ?? null,
    invoiceDate: r.invoiceDate ?? null,
    category: r.category ?? null,
    department: r.department,
    supervisorId: r.supervisorId,
    supervisorName: r.supervisorName,
    groupId: r.groupId ?? null,
    items,
    subtotal: r.subtotal ?? null,
    tax: r.tax ?? null,
    total: r.total,
    currency: r.currency || 'SAR',
    imageData: r.imageData ?? null,
    entryMode: r.entryMode || 'manual',
    aiExtracted: !!r.aiExtracted,
    aiConfidence: r.aiConfidence ?? null,
    status: r.status || 'pending',
    settlement: r.settlement || 'unsettled',
    reviewedBy: r.reviewedBy ?? null,
    reviewNote: r.reviewNote ?? null,
    settledAt: r.settledAt
      ? typeof r.settledAt === 'string'
        ? r.settledAt
        : r.settledAt.toISOString()
      : null,
    createdAt:
      typeof r.createdAt === 'string'
        ? r.createdAt
        : r.createdAt?.toISOString?.() || new Date().toISOString()
  };
}

export type CreateInvoiceInput = {
  title: string;
  vendor?: string | null;
  invoiceDate?: string | null;
  category?: string | null;
  department: string;
  supervisorId: number;
  supervisorName: string;
  groupId?: number | null;
  items: InvoiceItem[];
  subtotal?: number | null;
  tax?: number | null;
  total: number;
  currency?: string;
  imageData?: string | null;
  entryMode?: string;
  aiExtracted?: boolean;
  aiConfidence?: number | null;
};

export async function getInvoices(): Promise<InvoiceInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
    return list.map(mapInvoiceRow);
  } else {
    const list = await readJsonFile<any[]>(FILE_INVOICES, []);
    return list.map(mapInvoiceRow).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
}

export async function createInvoice(data: CreateInvoiceInput): Promise<InvoiceInfo> {
  const itemsJson = JSON.stringify(data.items || []);
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const count = await prisma.invoice.count();
    const invoiceNo = INVOICE_BASE + count + 1;
    const created = await prisma.invoice.create({
      data: {
        invoiceNo,
        title: data.title,
        vendor: data.vendor ?? null,
        invoiceDate: data.invoiceDate ?? null,
        category: data.category ?? null,
        department: data.department,
        supervisorId: data.supervisorId,
        supervisorName: data.supervisorName,
        groupId: data.groupId ?? null,
        items: itemsJson,
        subtotal: data.subtotal ?? null,
        tax: data.tax ?? null,
        total: data.total,
        currency: data.currency || 'SAR',
        imageData: data.imageData ?? null,
        entryMode: data.entryMode || 'manual',
        aiExtracted: !!data.aiExtracted,
        aiConfidence: data.aiConfidence ?? null
      }
    });
    return mapInvoiceRow(created);
  } else {
    const list = await readJsonFile<any[]>(FILE_INVOICES, []);
    const id = list.length > 0 ? Math.max(...list.map((i) => i.id || 0)) + 1 : 1;
    const invoiceNo = INVOICE_BASE + list.length + 1;
    const row = {
      id,
      invoiceNo,
      title: data.title,
      vendor: data.vendor ?? null,
      invoiceDate: data.invoiceDate ?? null,
      category: data.category ?? null,
      department: data.department,
      supervisorId: data.supervisorId,
      supervisorName: data.supervisorName,
      groupId: data.groupId ?? null,
      items: itemsJson,
      subtotal: data.subtotal ?? null,
      tax: data.tax ?? null,
      total: data.total,
      currency: data.currency || 'SAR',
      imageData: data.imageData ?? null,
      entryMode: data.entryMode || 'manual',
      aiExtracted: !!data.aiExtracted,
      aiConfidence: data.aiConfidence ?? null,
      status: 'pending',
      settlement: 'unsettled',
      reviewedBy: null,
      reviewNote: null,
      settledAt: null,
      createdAt: new Date().toISOString()
    };
    list.push(row);
    await writeJsonFile(FILE_INVOICES, list);
    return mapInvoiceRow(row);
  }
}

export async function updateInvoice(
  id: number,
  patch: Partial<{
    title: string;
    vendor: string | null;
    invoiceDate: string | null;
    category: string | null;
    department: string;
    groupId: number | null;
    items: InvoiceItem[];
    subtotal: number | null;
    tax: number | null;
    total: number;
    status: string;
    settlement: string;
    reviewedBy: string | null;
    reviewNote: string | null;
    settledAt: string | null;
  }>
): Promise<InvoiceInfo | null> {
  const dbData: any = {};
  const simpleKeys = [
    'title', 'vendor', 'invoiceDate', 'category', 'department', 'groupId',
    'subtotal', 'tax', 'total', 'status', 'settlement', 'reviewedBy', 'reviewNote'
  ] as const;
  for (const k of simpleKeys) {
    if ((patch as any)[k] !== undefined) dbData[k] = (patch as any)[k];
  }
  if (patch.items !== undefined) dbData.items = JSON.stringify(patch.items);
  if (patch.settledAt !== undefined) dbData.settledAt = patch.settledAt ? new Date(patch.settledAt) : null;

  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const updated = await prisma.invoice.update({ where: { id }, data: dbData });
      return mapInvoiceRow(updated);
    } catch {
      return null;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_INVOICES, []);
    const index = list.findIndex((i) => i.id === id);
    if (index === -1) return null;
    const row = { ...list[index] };
    Object.keys(dbData).forEach((k) => {
      row[k] = dbData[k] instanceof Date ? dbData[k].toISOString() : dbData[k];
    });
    list[index] = row;
    await writeJsonFile(FILE_INVOICES, list);
    return mapInvoiceRow(row);
  }
}

export async function deleteInvoice(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await prisma.invoice.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_INVOICES, []);
    const index = list.findIndex((i) => i.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    await writeJsonFile(FILE_INVOICES, list);
    return true;
  }
}

// ==================== TASKS & SUBMISSIONS SERVICES ====================

export type TaskInfo = {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  startDate: string | null;
  dueDate: string;
  createdAt: string;
  track: string | null;
  stage?: string | null;       // المرحلة المعنية — '' / 'الكل' = all stages
  cost?: number;               // points deducted from the student's balance when claiming
  durationHours?: number | null; // hours the student has to finish after claiming (null = open)
  isActive: boolean;
  submissionMethod: string | null;
  assignedAdmins: string[];
  imageUrl: string | null;
  resourceLink: string | null;
  visibility: string;
  visibleToIds: number[];
};

export type SubmissionInfo = {
  id: string;
  registrationId: number;
  taskId: string;
  fileUrl: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  selectedAdminId: string | null;
  claimedAt?: string | null;
  submittedAt: string;
  studentName?: string;
  taskTitle?: string;
  taskMaxPoints?: number;
  taskTrack?: string | null;
  taskAssignedAdmins?: string[];
};

export async function getTasks(): Promise<TaskInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
    return list.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      maxPoints: t.maxPoints,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      dueDate: t.dueDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
      track: t.track,
      stage: (t as any).stage ?? null,
      cost: (t as any).cost ?? 0,
      durationHours: (t as any).durationHours ?? null,
      isActive: t.isActive,
      submissionMethod: t.submissionMethod,
      assignedAdmins: t.assignedAdmins,
      imageUrl: t.imageUrl,
      resourceLink: t.resourceLink,
      visibility: t.visibility,
      visibleToIds: t.visibleToIds,
    }));
  } else {
    const list = await readJsonFile<any[]>(FILE_TASKS, []);
    return list.map(t => ({
      id: String(t.id),
      title: String(t.title),
      description: String(t.description),
      maxPoints: Number(t.maxPoints),
      startDate: t.startDate || null,
      dueDate: String(t.dueDate),
      createdAt: String(t.createdAt || new Date().toISOString()),
      track: t.track || 'عام',
      stage: t.stage ?? null,
      cost: Number(t.cost ?? 0),
      durationHours: t.durationHours ?? null,
      isActive: t.isActive !== false,
      submissionMethod: t.submissionMethod || 'file',
      assignedAdmins: Array.isArray(t.assignedAdmins) ? t.assignedAdmins : [],
      imageUrl: t.imageUrl || null,
      resourceLink: t.resourceLink || null,
      visibility: t.visibility || 'all',
      visibleToIds: Array.isArray(t.visibleToIds) ? t.visibleToIds.map(Number) : [],
    })).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
}

export async function getTaskById(id: string): Promise<TaskInfo | null> {
  const tasks = await getTasks();
  return tasks.find(t => t.id === id) || null;
}

export async function createTask(data: Omit<TaskInfo, 'id' | 'createdAt'>): Promise<TaskInfo> {
  const crypto = await import('crypto');
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const task: TaskInfo = {
    id,
    createdAt,
    ...data
  };

  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.task.create({
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        maxPoints: task.maxPoints,
        startDate: task.startDate ? new Date(task.startDate) : null,
        dueDate: new Date(task.dueDate),
        track: task.track,
        stage: task.stage ?? null,
        cost: task.cost ?? 0,
        durationHours: task.durationHours ?? null,
        isActive: task.isActive,
        submissionMethod: task.submissionMethod,
        assignedAdmins: task.assignedAdmins,
        imageUrl: task.imageUrl,
        resourceLink: task.resourceLink,
        visibility: task.visibility,
        visibleToIds: task.visibleToIds,
        createdAt: new Date(task.createdAt),
      }
    });
  } else {
    const list = await readJsonFile<any[]>(FILE_TASKS, []);
    list.push(task);
    await writeJsonFile(FILE_TASKS, list);
  }
  return task;
}

export async function updateTask(id: string, patch: Partial<Omit<TaskInfo, 'id' | 'createdAt'>>): Promise<TaskInfo | null> {
  const dbData: any = {};
  const allowedKeys = [
    'title', 'description', 'maxPoints', 'startDate', 'dueDate', 'track', 'stage', 'cost', 'durationHours', 'isActive',
    'submissionMethod', 'assignedAdmins', 'imageUrl', 'resourceLink', 'visibility', 'visibleToIds'
  ] as const;

  for (const k of allowedKeys) {
    if (patch[k] !== undefined) dbData[k] = patch[k];
  }
  if (patch.startDate !== undefined) dbData.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.dueDate !== undefined) dbData.dueDate = new Date(patch.dueDate);

  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const updated = await prisma.task.update({
        where: { id },
        data: dbData
      });
      return {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        maxPoints: updated.maxPoints,
        startDate: (updated as any).startDate ? (updated as any).startDate.toISOString() : null,
        dueDate: updated.dueDate.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        track: updated.track,
        stage: (updated as any).stage ?? null,
        cost: (updated as any).cost ?? 0,
        durationHours: (updated as any).durationHours ?? null,
        isActive: updated.isActive,
        submissionMethod: updated.submissionMethod,
        assignedAdmins: updated.assignedAdmins,
        imageUrl: updated.imageUrl,
        resourceLink: updated.resourceLink,
        visibility: updated.visibility,
        visibleToIds: updated.visibleToIds,
      };
    } catch {
      return null;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_TASKS, []);
    const index = list.findIndex(t => String(t.id) === id);
    if (index === -1) return null;
    const task = { ...list[index] };
    for (const k of allowedKeys) {
      if (patch[k] !== undefined) task[k] = patch[k];
    }
    list[index] = task;
    await writeJsonFile(FILE_TASKS, list);
    return task;
  }
}

export async function deleteTask(id: string): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await prisma.submission.deleteMany({ where: { taskId: id } });
      await prisma.task.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const tasks = await readJsonFile<any[]>(FILE_TASKS, []);
    const taskIndex = tasks.findIndex(t => String(t.id) === id);
    if (taskIndex === -1) return false;
    tasks.splice(taskIndex, 1);
    await writeJsonFile(FILE_TASKS, tasks);

    const submissions = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const remainingSubmissions = submissions.filter(s => String(s.taskId) !== id);
    await writeJsonFile(FILE_SUBMISSIONS, remainingSubmissions);

    return true;
  }
}

export async function getSubmissions(): Promise<SubmissionInfo[]> {
  const students = await getStudents();
  const tasks = await getTasks();
  const studentsMap = new Map(students.map(s => [s.id, s.studentName]));
  const tasksMap = new Map(tasks.map(t => [t.id, t]));

  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.submission.findMany({ orderBy: { submittedAt: 'desc' } });
    return list.map(s => {
      const task = tasksMap.get(s.taskId);
      return {
        id: s.id,
        registrationId: s.registrationId,
        taskId: s.taskId,
        fileUrl: s.fileUrl,
        status: s.status,
        grade: s.grade,
        feedback: s.feedback,
        selectedAdminId: s.selectedAdminId,
        claimedAt: (s as any).claimedAt ? (s as any).claimedAt.toISOString() : null,
        submittedAt: s.submittedAt.toISOString(),
        studentName: studentsMap.get(s.registrationId) || `طالب #${s.registrationId}`,
        taskTitle: task?.title || 'مهمة محذوفة',
        taskMaxPoints: task?.maxPoints || 0,
        taskTrack: task?.track || null,
        taskAssignedAdmins: task?.assignedAdmins || [],
      };
    });
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    return list.map(s => {
      const task = tasksMap.get(s.taskId);
      return {
        id: String(s.id),
        registrationId: Number(s.registrationId),
        taskId: String(s.taskId),
        fileUrl: String(s.fileUrl),
        status: String(s.status || 'pending'),
        grade: s.grade !== null && s.grade !== undefined ? Number(s.grade) : null,
        feedback: s.feedback || null,
        selectedAdminId: s.selectedAdminId || null,
        claimedAt: s.claimedAt || null,
        submittedAt: String(s.submittedAt || new Date().toISOString()),
        studentName: studentsMap.get(Number(s.registrationId)) || `طالب #${s.registrationId}`,
        taskTitle: task?.title || 'مهمة محذوفة',
        taskMaxPoints: task?.maxPoints || 0,
        taskTrack: task?.track || null,
        taskAssignedAdmins: task?.assignedAdmins || [],
      };
    }).sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
  }
}

export async function getSubmissionById(id: string): Promise<SubmissionInfo | null> {
  const list = await getSubmissions();
  return list.find(s => s.id === id) || null;
}

export async function upsertSubmission(data: Omit<SubmissionInfo, 'id' | 'submittedAt'> & { id?: string }): Promise<SubmissionInfo> {
  const crypto = await import('crypto');
  const now = new Date().toISOString();
  const tasks = await getTasks();
  const task = tasks.find(t => t.id === data.taskId);
  const students = await getStudents();
  const student = students.find(s => s.id === data.registrationId);

  const subId = data.id || crypto.randomUUID();

  if (hasDatabase) {
    const prisma = getPrisma()!;
    const row = await prisma.submission.upsert({
      where: {
        registrationId_taskId: {
          registrationId: data.registrationId,
          taskId: data.taskId,
        }
      },
      update: {
        fileUrl: data.fileUrl,
        status: data.status,
        grade: data.grade,
        feedback: data.feedback,
        selectedAdminId: data.selectedAdminId,
        submittedAt: new Date(now),
      },
      create: {
        id: subId,
        registrationId: data.registrationId,
        taskId: data.taskId,
        fileUrl: data.fileUrl,
        status: data.status,
        grade: data.grade,
        feedback: data.feedback,
        selectedAdminId: data.selectedAdminId,
        submittedAt: new Date(now),
      }
    });
    return {
      id: row.id,
      registrationId: row.registrationId,
      taskId: row.taskId,
      fileUrl: row.fileUrl,
      status: row.status,
      grade: row.grade,
      feedback: row.feedback,
      selectedAdminId: row.selectedAdminId,
      submittedAt: row.submittedAt.toISOString(),
      studentName: student?.studentName || `طالب #${data.registrationId}`,
      taskTitle: task?.title || 'مهمة محذوفة',
      taskMaxPoints: task?.maxPoints || 0,
      taskTrack: task?.track || null,
      taskAssignedAdmins: task?.assignedAdmins || [],
    };
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const index = list.findIndex(s => s.registrationId === data.registrationId && s.taskId === data.taskId);

    const submission: SubmissionInfo = {
      id: index !== -1 ? list[index].id : subId,
      registrationId: data.registrationId,
      taskId: data.taskId,
      fileUrl: data.fileUrl,
      status: data.status,
      grade: data.grade,
      feedback: data.feedback,
      selectedAdminId: data.selectedAdminId,
      submittedAt: now,
      studentName: student?.studentName || `طالب #${data.registrationId}`,
      taskTitle: task?.title || 'مهمة محذوفة',
      taskMaxPoints: task?.maxPoints || 0,
      taskTrack: task?.track || null,
      taskAssignedAdmins: task?.assignedAdmins || [],
    };

    if (index !== -1) {
      list[index] = { ...list[index], ...data, submittedAt: now };
    } else {
      list.push(submission);
    }
    await writeJsonFile(FILE_SUBMISSIONS, list);
    return submission;
  }
}

export async function updateSubmission(id: string, patch: Partial<Omit<SubmissionInfo, 'id' | 'submittedAt'>>): Promise<SubmissionInfo | null> {
  const dbData: any = {};
  const allowedKeys = ['fileUrl', 'status', 'grade', 'feedback', 'selectedAdminId'] as const;
  for (const k of allowedKeys) {
    if (patch[k] !== undefined) dbData[k] = patch[k];
  }

  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const updated = await prisma.submission.update({
        where: { id },
        data: dbData
      });
      const tasks = await getTasks();
      const task = tasks.find(t => t.id === updated.taskId);
      const students = await getStudents();
      const student = students.find(s => s.id === updated.registrationId);

      return {
        id: updated.id,
        registrationId: updated.registrationId,
        taskId: updated.taskId,
        fileUrl: updated.fileUrl,
        status: updated.status,
        grade: updated.grade,
        feedback: updated.feedback,
        selectedAdminId: updated.selectedAdminId,
        submittedAt: updated.submittedAt.toISOString(),
        studentName: student?.studentName || `طالب #${updated.registrationId}`,
        taskTitle: task?.title || 'مهمة محذوفة',
        taskMaxPoints: task?.maxPoints || 0,
        taskTrack: task?.track || null,
        taskAssignedAdmins: task?.assignedAdmins || [],
      };
    } catch {
      return null;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const index = list.findIndex(s => String(s.id) === id);
    if (index === -1) return null;
    const row = { ...list[index] };
    for (const k of allowedKeys) {
      if (patch[k] !== undefined) row[k] = patch[k];
    }
    list[index] = row;
    await writeJsonFile(FILE_SUBMISSIONS, list);
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === row.taskId);
    const students = await getStudents();
    const student = students.find(s => s.id === row.registrationId);
    return {
      id: String(row.id),
      registrationId: Number(row.registrationId),
      taskId: String(row.taskId),
      fileUrl: String(row.fileUrl),
      status: String(row.status),
      grade: row.grade !== null && row.grade !== undefined ? Number(row.grade) : null,
      feedback: row.feedback || null,
      selectedAdminId: row.selectedAdminId || null,
      submittedAt: String(row.submittedAt),
      studentName: student?.studentName || `طالب #${row.registrationId}`,
      taskTitle: task?.title || 'مهمة محذوفة',
      taskMaxPoints: task?.maxPoints || 0,
      taskTrack: task?.track || null,
      taskAssignedAdmins: task?.assignedAdmins || [],
    };
  }
}

// ─── TASK ECONOMY: claim / submit / cancel / expire ──────────────────────────
// A student must "claim" a task (paying its cost) before submitting. Statuses:
// claimed → pending → approved | rejected ; or cancelled | expired.

export const ACTIVE_CLAIM_STATUSES = ['claimed', 'pending', 'rejected'];

export async function expireStaleClaims(): Promise<void> {
  const now = Date.now();
  const tasks = await getTasks();
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const isStale = (claimedAtIso: string | null, taskId: string) => {
    const t = taskMap.get(taskId);
    const dur = t?.durationHours ?? null;
    if (!dur || dur <= 0 || !claimedAtIso) return false;
    return new Date(claimedAtIso).getTime() + dur * 3600000 < now;
  };
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const claimed = await prisma.submission.findMany({ where: { status: 'claimed' } });
    for (const s of claimed) {
      const claimedAt = (s as any).claimedAt ? (s as any).claimedAt.toISOString() : s.submittedAt.toISOString();
      if (isStale(claimedAt, s.taskId)) {
        await prisma.submission.update({ where: { id: s.id }, data: { status: 'expired' } });
      }
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    let changed = false;
    for (const s of list) {
      if (s.status !== 'claimed') continue;
      const claimedAt = s.claimedAt || s.submittedAt || null;
      if (isStale(claimedAt, String(s.taskId))) { s.status = 'expired'; changed = true; }
    }
    if (changed) await writeJsonFile(FILE_SUBMISSIONS, list);
  }
}

export async function claimTask(registrationId: number, taskId: string): Promise<{ submission?: SubmissionInfo; error?: string }> {
  await expireStaleClaims();
  const tasks = await getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.isActive) return { error: 'المهمة غير متاحة' };

  const subs = await getSubmissions();
  const mine = subs.filter(s => s.registrationId === registrationId);
  const existing = mine.find(s => s.taskId === taskId);
  if (existing && ACTIVE_CLAIM_STATUSES.includes(existing.status)) return { error: 'لقد طلبت هذه المهمة بالفعل' };
  if (existing && existing.status === 'approved') return { error: 'لقد أنجزت هذه المهمة بالفعل' };

  const active = mine.filter(s => ACTIVE_CLAIM_STATUSES.includes(s.status));
  if (active.length >= 3) return { error: 'لا يمكنك طلب أكثر من ٣ مهام نشطة في آنٍ واحد' };
  const track = task.track || 'عام';
  if (active.some(s => (s.taskTrack || 'عام') === track)) return { error: 'لديك مهمة نشطة في نفس القسم — أنهِها أولاً' };

  const crypto = await import('crypto');
  const now = new Date();
  const cost = task.cost ?? 0;

  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.submission.upsert({
      where: { registrationId_taskId: { registrationId, taskId } },
      update: { status: 'claimed', fileUrl: '', grade: null, feedback: null, claimedAt: now, submittedAt: now },
      create: { id: crypto.randomUUID(), registrationId, taskId, fileUrl: '', status: 'claimed', grade: null, feedback: null, selectedAdminId: null, claimedAt: now, submittedAt: now },
    });
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const idx = list.findIndex(s => Number(s.registrationId) === registrationId && String(s.taskId) === taskId);
    const base = { registrationId, taskId, fileUrl: '', status: 'claimed', grade: null, feedback: null, selectedAdminId: null, claimedAt: now.toISOString(), submittedAt: now.toISOString() };
    if (idx !== -1) list[idx] = { ...list[idx], ...base };
    else list.push({ id: crypto.randomUUID(), ...base });
    await writeJsonFile(FILE_SUBMISSIONS, list);
  }

  if (cost > 0) {
    await addPointsRecord({ registrationId, delta: -cost, reason: `طلب مهمة: ${task.title}`, category: 'tasks', pointType: 'deduction', recordedBy: 'النظام' });
  }

  const refreshed = await getSubmissions();
  return { submission: refreshed.find(s => s.registrationId === registrationId && s.taskId === taskId) };
}

export async function submitClaim(registrationId: number, taskId: string, fileUrl: string): Promise<{ submission?: SubmissionInfo; error?: string }> {
  await expireStaleClaims();
  const subs = await getSubmissions();
  const existing = subs.find(s => s.registrationId === registrationId && s.taskId === taskId);
  if (!existing || !['claimed', 'rejected'].includes(existing.status)) {
    return { error: 'يجب طلب المهمة أولاً قبل تسليمها' };
  }
  const wasClaimed = existing.status === 'claimed'; // deposit still held → release it (full) on first submit
  const now = new Date();
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.submission.update({ where: { id: existing.id }, data: { fileUrl, status: 'pending', submittedAt: now } });
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const idx = list.findIndex(s => String(s.id) === existing.id);
    if (idx !== -1) { list[idx] = { ...list[idx], fileUrl, status: 'pending', submittedAt: now.toISOString() }; await writeJsonFile(FILE_SUBMISSIONS, list); }
  }
  // Submitting returns the full deposit (the task cost) to the student's balance
  if (wasClaimed) await refundTaskCost(registrationId, taskId);
  const refreshed = await getSubmissions();
  return { submission: refreshed.find(s => s.id === existing.id) };
}

export async function cancelClaim(registrationId: number, taskId: string): Promise<{ ok: boolean; error?: string }> {
  const subs = await getSubmissions();
  const existing = subs.find(s => s.registrationId === registrationId && s.taskId === taskId);
  if (!existing || !ACTIVE_CLAIM_STATUSES.includes(existing.status)) return { ok: false, error: 'لا توجد مهمة نشطة لإلغائها' };
  const wasClaimed = existing.status === 'claimed'; // deposit only held while not yet submitted
  const tasks = await getTasks();
  const task = tasks.find(t => t.id === taskId);
  const cost = task?.cost ?? 0;
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await prisma.submission.update({ where: { id: existing.id }, data: { status: 'cancelled' } });
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const idx = list.findIndex(s => String(s.id) === existing.id);
    if (idx !== -1) { list[idx] = { ...list[idx], status: 'cancelled' }; await writeJsonFile(FILE_SUBMISSIONS, list); }
  }
  // Cancelling returns HALF the deposit — only if it was still held (not yet submitted)
  const refund = wasClaimed ? Math.floor(cost / 2) : 0;
  if (refund > 0) {
    await addPointsRecord({ registrationId, delta: refund, reason: `استرداد نصف مبلغ مهمة ملغاة: ${task?.title || ''}`, category: 'tasks', pointType: 'deduction', recordedBy: 'النظام' });
  }
  return { ok: true };
}

// Returns the held deposit (the full task cost) to the student's balance.
export async function refundTaskCost(registrationId: number, taskId: string): Promise<void> {
  const tasks = await getTasks();
  const task = tasks.find(t => t.id === taskId);
  const cost = task?.cost ?? 0;
  if (cost > 0) {
    await addPointsRecord({ registrationId, delta: cost, reason: `استرداد مبلغ المهمة: ${task?.title || ''}`, category: 'tasks', pointType: 'deduction', recordedBy: 'النظام' });
  }
}

export async function deleteSubmission(id: string): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await prisma.submission.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_SUBMISSIONS, []);
    const index = list.findIndex(s => String(s.id) === id);
    if (index === -1) return false;
    list.splice(index, 1);
    await writeJsonFile(FILE_SUBMISSIONS, list);
    return true;
  }
}

// ==================== SCHEDULE SERVICES ====================
export async function getSchedules(): Promise<ScheduleInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.schedule.findMany({
      orderBy: { date: 'asc' }
    });
    return list.map(s => ({
      id: s.id,
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      role: s.role,
      supervisorId: s.supervisorId,
      stage: s.stage || 'الكل',
      notes: s.notes,
      createdAt: s.createdAt.toISOString()
    }));
  } else {
    const list = await readJsonFile<any[]>(FILE_SCHEDULES, []);
    return list.map(s => ({
      id: s.id,
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      role: s.role,
      supervisorId: s.supervisorId,
      stage: s.stage || 'الكل',
      notes: s.notes || null,
      createdAt: s.createdAt
    }));
  }
}

export async function createSchedule(data: Omit<ScheduleInfo, 'id' | 'createdAt'>): Promise<ScheduleInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const s = await prisma.schedule.create({
      data: {
        title: data.title,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        role: data.role,
        supervisorId: data.supervisorId,
        stage: data.stage,
        notes: data.notes
      }
    });
    return {
      id: s.id,
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      role: s.role,
      supervisorId: s.supervisorId,
      stage: s.stage,
      notes: s.notes,
      createdAt: s.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<ScheduleInfo[]>(FILE_SCHEDULES, []);
    const newSchedule: ScheduleInfo = {
      id: crypto.randomUUID(),
      ...data,
      stage: data.stage || 'الكل',
      createdAt: new Date().toISOString()
    };
    list.push(newSchedule);
    await writeJsonFile(FILE_SCHEDULES, list);
    return newSchedule;
  }
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (hasDatabase) {
    try {
      const prisma = getPrisma()!;
      await prisma.schedule.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const list = await readJsonFile<ScheduleInfo[]>(FILE_SCHEDULES, []);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(FILE_SCHEDULES, list);
    return true;
  }
}

export async function updateSchedule(
  id: string,
  data: Partial<Omit<ScheduleInfo, 'id' | 'createdAt'>>
): Promise<ScheduleInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const updated = await prisma.schedule.update({
        where: { id },
        data: {
          title: data.title,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          role: data.role,
          supervisorId: data.supervisorId,
          stage: data.stage,
          notes: data.notes
        }
      });
      return {
        id: updated.id,
        title: updated.title,
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
        role: updated.role,
        supervisorId: updated.supervisorId,
        stage: updated.stage,
        notes: updated.notes,
        createdAt: updated.createdAt.toISOString()
      };
    } catch {
      return null;
    }
  } else {
    const list = await readJsonFile<ScheduleInfo[]>(FILE_SCHEDULES, []);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    await writeJsonFile(FILE_SCHEDULES, list);
    return updated;
  }
}

// ==================== GENERAL EXPENSES & OTHER REVENUES SERVICES ====================

export type GeneralExpenseInfo = {
  id: number;
  title: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  notes: string | null;
  supervisorId: number;
  supervisorName: string;
  createdAt: string;
};

export type OtherRevenueInfo = {
  id: number;
  title: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  notes: string | null;
  supervisorId: number;
  supervisorName: string;
  createdAt: string;
};

export async function getGeneralExpenses(): Promise<GeneralExpenseInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.generalExpense.findMany({ orderBy: { date: 'desc' } });
    return list.map(x => ({
      id: x.id,
      title: x.title,
      amount: x.amount,
      date: x.date,
      notes: x.notes,
      supervisorId: x.supervisorId,
      supervisorName: x.supervisorName,
      createdAt: x.createdAt.toISOString()
    }));
  } else {
    const list = await readJsonFile<any[]>(FILE_GENERAL_EXPENSES, []);
    return list.map(x => ({
      id: Number(x.id),
      title: String(x.title),
      amount: Number(x.amount),
      date: String(x.date),
      notes: x.notes ? String(x.notes) : null,
      supervisorId: Number(x.supervisorId),
      supervisorName: String(x.supervisorName),
      createdAt: String(x.createdAt || new Date().toISOString())
    })).sort((a, b) => b.date.localeCompare(a.date));
  }
}

export async function createGeneralExpense(data: Omit<GeneralExpenseInfo, 'id' | 'createdAt'>): Promise<GeneralExpenseInfo> {
  const createdAt = new Date().toISOString();
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const created = await prisma.generalExpense.create({
      data: {
        title: data.title,
        amount: data.amount,
        date: data.date,
        notes: data.notes,
        supervisorId: data.supervisorId,
        supervisorName: data.supervisorName,
        createdAt: new Date(createdAt)
      }
    });
    return {
      id: created.id,
      title: created.title,
      amount: created.amount,
      date: created.date,
      notes: created.notes,
      supervisorId: created.supervisorId,
      supervisorName: created.supervisorName,
      createdAt: created.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<any[]>(FILE_GENERAL_EXPENSES, []);
    const id = list.length > 0 ? Math.max(...list.map(x => x.id || 0)) + 1 : 1;
    const row: GeneralExpenseInfo = {
      id,
      title: data.title,
      amount: data.amount,
      date: data.date,
      notes: data.notes,
      supervisorId: data.supervisorId,
      supervisorName: data.supervisorName,
      createdAt
    };
    list.push(row);
    await writeJsonFile(FILE_GENERAL_EXPENSES, list);
    return row;
  }
}

export async function deleteGeneralExpense(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await prisma.generalExpense.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_GENERAL_EXPENSES, []);
    const index = list.findIndex(x => x.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    await writeJsonFile(FILE_GENERAL_EXPENSES, list);
    return true;
  }
}

export async function getOtherRevenues(): Promise<OtherRevenueInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.otherRevenue.findMany({ orderBy: { date: 'desc' } });
    return list.map(x => ({
      id: x.id,
      title: x.title,
      amount: x.amount,
      date: x.date,
      notes: x.notes,
      supervisorId: x.supervisorId,
      supervisorName: x.supervisorName,
      createdAt: x.createdAt.toISOString()
    }));
  } else {
    const list = await readJsonFile<any[]>(FILE_OTHER_REVENUES, []);
    return list.map(x => ({
      id: Number(x.id),
      title: String(x.title),
      amount: Number(x.amount),
      date: String(x.date),
      notes: x.notes ? String(x.notes) : null,
      supervisorId: Number(x.supervisorId),
      supervisorName: String(x.supervisorName),
      createdAt: String(x.createdAt || new Date().toISOString())
    })).sort((a, b) => b.date.localeCompare(a.date));
  }
}

export async function createOtherRevenue(data: Omit<OtherRevenueInfo, 'id' | 'createdAt'>): Promise<OtherRevenueInfo> {
  const createdAt = new Date().toISOString();
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const created = await prisma.otherRevenue.create({
      data: {
        title: data.title,
        amount: data.amount,
        date: data.date,
        notes: data.notes,
        supervisorId: data.supervisorId,
        supervisorName: data.supervisorName,
        createdAt: new Date(createdAt)
      }
    });
    return {
      id: created.id,
      title: created.title,
      amount: created.amount,
      date: created.date,
      notes: created.notes,
      supervisorId: created.supervisorId,
      supervisorName: created.supervisorName,
      createdAt: created.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<any[]>(FILE_OTHER_REVENUES, []);
    const id = list.length > 0 ? Math.max(...list.map(x => x.id || 0)) + 1 : 1;
    const row: OtherRevenueInfo = {
      id,
      title: data.title,
      amount: data.amount,
      date: data.date,
      notes: data.notes,
      supervisorId: data.supervisorId,
      supervisorName: data.supervisorName,
      createdAt
    };
    list.push(row);
    await writeJsonFile(FILE_OTHER_REVENUES, list);
    return row;
  }
}

export async function deleteOtherRevenue(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await prisma.otherRevenue.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const list = await readJsonFile<any[]>(FILE_OTHER_REVENUES, []);
    const index = list.findIndex(x => x.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    await writeJsonFile(FILE_OTHER_REVENUES, list);
    return true;
  }
}

// ==================== NOTIFICATION SERVICES ====================

export type NotificationInfo = {
  id: string;
  type: string;
  targetType: string; // 'student' | 'supervisor'
  targetId: number;
  title: string;
  body: string;
  isRead: boolean;
  relatedTaskId: string | null;
  relatedSubId: string | null;
  createdAt: string;
};

const FILE_NOTIFICATIONS = path.join(DATA_DIR, 'notifications.json');

export async function createNotification(data: Omit<NotificationInfo, 'id' | 'createdAt' | 'isRead'>): Promise<NotificationInfo> {
  const createdAt = new Date().toISOString();
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const row = await (prisma as any).notification.create({
      data: {
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        title: data.title,
        body: data.body,
        relatedTaskId: data.relatedTaskId || null,
        relatedSubId: data.relatedSubId || null,
      }
    });
    return {
      id: row.id,
      type: row.type,
      targetType: row.targetType,
      targetId: row.targetId,
      title: row.title,
      body: row.body,
      isRead: row.isRead,
      relatedTaskId: row.relatedTaskId,
      relatedSubId: row.relatedSubId,
      createdAt: row.createdAt.toISOString(),
    };
  } else {
    const list = await readJsonFile<NotificationInfo[]>(FILE_NOTIFICATIONS, []);
    const n: NotificationInfo = {
      id: Math.random().toString(36).slice(2),
      ...data,
      isRead: false,
      createdAt,
    };
    list.push(n);
    await writeJsonFile(FILE_NOTIFICATIONS, list);
    return n;
  }
}

export async function getNotifications(targetType: string, targetId: number): Promise<NotificationInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await (prisma as any).notification.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return list.map((r: any) => ({
      id: r.id,
      type: r.type,
      targetType: r.targetType,
      targetId: r.targetId,
      title: r.title,
      body: r.body,
      isRead: r.isRead,
      relatedTaskId: r.relatedTaskId,
      relatedSubId: r.relatedSubId,
      createdAt: r.createdAt.toISOString(),
    }));
  } else {
    const list = await readJsonFile<NotificationInfo[]>(FILE_NOTIFICATIONS, []);
    return list
      .filter(n => n.targetType === targetType && n.targetId === targetId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 50);
  }
}

export async function markNotificationsRead(targetType: string, targetId: number): Promise<void> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    await (prisma as any).notification.updateMany({
      where: { targetType, targetId, isRead: false },
      data: { isRead: true },
    });
  } else {
    const list = await readJsonFile<NotificationInfo[]>(FILE_NOTIFICATIONS, []);
    list.forEach(n => {
      if (n.targetType === targetType && n.targetId === targetId) n.isRead = true;
    });
    await writeJsonFile(FILE_NOTIFICATIONS, list);
  }
}

// ==================== STUDENT PORTAL SERVICES ====================

export async function getStudentByCredentials(membershipNo: number, nationalId: string): Promise<StudentInfo | null> {
  const students = await getStudents();
  return students.find(s => s.membershipNo === membershipNo && s.nationalId === nationalId) || null;
}

export async function getStudentScheduleToday(stage: string): Promise<ScheduleInfo[]> {
  const schedules = await getSchedules();
  const today = new Date().toISOString().split('T')[0];
  return schedules.filter(s => s.date === today && (s.stage === stage || s.stage === 'الكل'));
}

export async function getStudentPoints(registrationId: number): Promise<PointInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.point.findMany({
      where: { registrationId },
      orderBy: { createdAt: 'desc' }
    });
    return list.map(p => ({
      id: p.id,
      registrationId: p.registrationId,
      delta: p.delta,
      reason: p.reason,
      category: p.category,
      pointType: (p.pointType || 'individual') as 'individual' | 'collective' | 'deduction',
      recordedBy: p.recordedBy,
      createdAt: p.createdAt.toISOString()
    }));
  } else {
    const list = await readJsonFile<PointInfo[]>(FILE_POINTS, []);
    return list
      .filter(p => p.registrationId === registrationId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
}

export async function getStudentAttendance(registrationId: number): Promise<AttendanceInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.attendance.findMany({
      where: { registrationId },
      orderBy: { date: 'desc' }
    });
    return list.map(a => ({
      id: a.id,
      registrationId: a.registrationId,
      date: a.date,
      status: a.status,
      recordedBy: a.recordedBy,
      createdAt: a.createdAt.toISOString()
    }));
  } else {
    const list = await readJsonFile<AttendanceInfo[]>(FILE_ATTENDANCE, []);
    return list
      .filter(a => a.registrationId === registrationId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

export async function getStudentTasksWithSubmissions(registrationId: number, stage: string): Promise<{
  task: TaskInfo;
  submission: SubmissionInfo | null;
}[]> {
  await expireStaleClaims();
  const tasks = await getTasks();
  const submissions = await getSubmissions();

  const activeTasks = tasks.filter(t => {
    if (!t.isActive) return false;
    if (t.visibility === 'specific') {
      return t.visibleToIds.includes(registrationId);
    }
    // Stage targeting (المرحلة المعنية): empty / 'الكل' means all stages
    if (t.stage && t.stage !== 'الكل' && stage && t.stage !== stage) return false;
    return true;
  });

  return activeTasks.map(task => ({
    task,
    submission: submissions.find(s => s.taskId === task.id && s.registrationId === registrationId) || null
  }));
}

export async function getStageLeaderboard(stage: string): Promise<{
  rank: number;
  registrationId: number;
  studentName: string;
  grade: string;
  rankScore: number;
  balance: number;
}[]> {
  const students = await getStudents();
  const stageStudents = students.filter(s => s.stage === stage);

  const allPoints = hasDatabase
    ? await (async () => {
      const prisma = getPrisma()!;
      const list = await prisma.point.findMany({
        where: { registrationId: { in: stageStudents.map(s => s.id) } }
      });
      return list.map(p => ({
        id: p.id, registrationId: p.registrationId, delta: p.delta,
        reason: p.reason, category: p.category,
        pointType: (p.pointType || 'individual') as 'individual' | 'collective' | 'deduction',
        recordedBy: p.recordedBy, createdAt: p.createdAt.toISOString()
      }));
    })()
    : await readJsonFile<PointInfo[]>(FILE_POINTS, []);

  const ranked = stageStudents.map(student => {
    const pts = allPoints.filter(p => p.registrationId === student.id);
    const { rankScore, balance } = calcPointSummary(pts);
    return { registrationId: student.id, studentName: student.studentName, grade: student.grade, rankScore, balance };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  return ranked.map((s, i) => ({ rank: i + 1, ...s }));
}

export async function getStudentGroup(groupId: number): Promise<{
  group: GroupInfo;
  supervisor: SupervisorInfo | null;
  members: StudentInfo[];
} | null> {
  const groups = await getGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return null;

  const supervisors = await getAllSupervisors();
  const supervisor = supervisors.find(s => {
    const ids = s.groupIds.split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n));
    return ids.includes(groupId) && s.role.split(',').map(r => r.trim()).some(r => r === 'groups_supervisor');
  }) || null;

  const students = await getStudents();
  const members = students.filter(s => s.groupId === groupId);

  return { group, supervisor, members };
}

export type StudentFamilyMember = {
  id: number;
  membershipNo: number;
  name: string;
  grade: string;
  rankScore: number;
  balance: number;
  individual: number;
  collective: number;
};

export type StudentFamilyResponse = {
  group: { id: number; name: string; stage: string };
  supervisor: { id: number; name: string } | null;
  members: StudentFamilyMember[];
  groupTotal: number;
  groupRank: number;
  groupCount: number;
} | null;

/**
 * Returns the student's family/group enriched with member point summaries,
 * the family's total rankScore (sum of members) and the family's rank
 * among all groups in the same stage.
 */
export async function getStudentFamily(groupId: number): Promise<StudentFamilyResponse> {
  const groups = await getGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return null;

  const supervisors = await getAllSupervisors();
  const supervisor = supervisors.find(s => {
    const ids = s.groupIds.split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n));
    return ids.includes(groupId) && s.role.split(',').map(r => r.trim()).some(r => r === 'groups_supervisor');
  }) || null;

  const students = await getStudents();
  const allPoints = await getPoints();

  // Compute per-student summaries for THIS group's members
  const members: StudentFamilyMember[] = students
    .filter(s => s.groupId === groupId)
    .map(s => {
      const pts = allPoints.filter(p => p.registrationId === s.id);
      const sum = calcPointSummary(pts);
      return {
        id: s.id,
        membershipNo: s.membershipNo,
        name: s.studentName,
        grade: s.grade,
        rankScore: sum.rankScore,
        balance: sum.balance,
        individual: sum.individual,
        collective: sum.collective,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);

  // Family points = the family's COLLECTIVE points only (what committee supervisors add via
  // "رصد جماعي للأسرة") — NOT the sum of members' individual achievements. Those collective
  // records are written once per member, so we dedupe by event to avoid multiplying.
  const isCollective = (p: PointInfo) =>
    p.pointType === 'collective' || (!p.pointType && p.reason.endsWith('(رصد جماعي للأسرة)'));
  const groupCollectiveTotal = (gid: number) => {
    const memberIds = new Set(students.filter(s => s.groupId === gid).map(s => s.id));
    const seen = new Set<string>();
    let total = 0;
    for (const p of allPoints) {
      if (!memberIds.has(p.registrationId) || !isCollective(p)) continue;
      const key = `${p.reason}__${p.delta}__${p.recordedBy ?? ''}__${p.createdAt.slice(0, 16)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total += p.delta;
    }
    return total;
  };

  const groupTotal = groupCollectiveTotal(groupId);

  // Rank ALL groups (in the same stage) by their collective points
  const sameStageGroups = groups.filter(g => g.stage === group.stage);
  const groupTotals = sameStageGroups.map(g => ({ id: g.id, total: groupCollectiveTotal(g.id) }));
  groupTotals.sort((a, b) => b.total - a.total);
  const groupRank = groupTotals.findIndex(g => g.id === groupId) + 1;

  return {
    group: { id: group.id, name: group.name, stage: group.stage },
    supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null,
    members,
    groupTotal,
    groupRank,
    groupCount: sameStageGroups.length,
  };
}

export async function getSetting(key: string): Promise<string | null> {
  if (hasDatabase) {
    try {
      const prisma = getPrisma()!;
      const s = await (prisma as any).setting.findUnique({ where: { key } });
      return s ? s.value : null;
    } catch {
      return null;
    }
  } else {
    const map = await readJsonFile<Record<string, string>>(FILE_SETTINGS, {});
    return map[key] ?? null;
  }
}

// ==================== SPORTS LEAGUE SERVICES ====================

export type SportLeagueInfo = {
  id: number;
  stage: string;
  title: string;
  status: string;        // 'setup' | 'active' | 'finished' | 'archived'
  pointsEnabled: boolean;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
};

export type SportMatchInfo = {
  id: number;
  leagueId: number;
  matchday: number;
  homeGroupId: number;
  awayGroupId: number;
  homeScore: number;
  awayScore: number;
  status: string;        // 'scheduled' | 'live' | 'finished'
  matchDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type SportGoalInfo = {
  id: number;
  matchId: number;
  teamGroupId: number;
  scorerId: number | null;
  scorerName: string;
  createdBy: string;
  createdAt: string;
};

export type SportCardInfo = {
  id: number;
  matchId: number;
  leagueId: number;
  studentId: number;
  studentName: string;
  groupId: number;
  cardType: string;      // 'yellow' | 'red'
  suspensionMatches: number;
  suspensionServed: boolean;
  punishedAt: string | null;  // when the violation was cleared via "تم المعاقبة"
  createdBy: string;
  createdAt: string;
};

export type SportBehaviorInfo = {
  id: number;
  leagueId: number;
  matchId: number | null;
  studentId: number;
  studentName: string;
  groupId: number;
  type: string;          // 'positive' | 'negative'
  description: string;
  createdBy: string;
  createdAt: string;
};

export type SportStanding = {
  groupId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

function mapSportLeague(r: any): SportLeagueInfo {
  return {
    id: r.id, stage: r.stage, title: r.title, status: r.status || 'setup',
    pointsEnabled: r.pointsEnabled ?? true, winPoints: r.winPoints ?? 2,
    drawPoints: r.drawPoints ?? 1, lossPoints: r.lossPoints ?? 0,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}
function mapSportMatch(r: any): SportMatchInfo {
  return {
    id: r.id, leagueId: r.leagueId, matchday: r.matchday ?? 1,
    homeGroupId: r.homeGroupId, awayGroupId: r.awayGroupId,
    homeScore: r.homeScore ?? 0, awayScore: r.awayScore ?? 0,
    status: r.status || 'scheduled', matchDate: r.matchDate ?? null, notes: r.notes ?? null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}
function mapSportGoal(r: any): SportGoalInfo {
  return {
    id: r.id, matchId: r.matchId, teamGroupId: r.teamGroupId,
    scorerId: r.scorerId ?? null, scorerName: r.scorerName,
    createdBy: r.createdBy,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}
function mapSportCard(r: any): SportCardInfo {
  return {
    id: r.id, matchId: r.matchId, leagueId: r.leagueId,
    studentId: r.studentId, studentName: r.studentName, groupId: r.groupId,
    cardType: r.cardType, suspensionMatches: r.suspensionMatches ?? 0,
    suspensionServed: r.suspensionServed ?? false,
    punishedAt: typeof r.punishedAt === 'string' ? r.punishedAt : r.punishedAt?.toISOString?.() ?? null,
    createdBy: r.createdBy,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}
function mapSportBehavior(r: any): SportBehaviorInfo {
  return {
    id: r.id, leagueId: r.leagueId, matchId: r.matchId ?? null,
    studentId: r.studentId, studentName: r.studentName, groupId: r.groupId,
    type: r.type, description: r.description, createdBy: r.createdBy,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}

// ─── LEAGUES ─────────────────────────────────────────────────────────────────

export async function getSportLeagues(stage?: string): Promise<SportLeagueInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await (prisma as any).sportLeague.findMany({
      where: stage ? { stage } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list.map(mapSportLeague);
  } else {
    let list = await readJsonFile<any[]>(FILE_SPORT_LEAGUES, []);
    if (stage) list = list.filter((l: any) => l.stage === stage);
    return list.sort((a: any, b: any) => b.id - a.id).map(mapSportLeague);
  }
}

export async function getSportLeagueById(id: number): Promise<SportLeagueInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportLeague.findUnique({ where: { id } });
    return r ? mapSportLeague(r) : null;
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_LEAGUES, []);
    const r = list.find((l: any) => l.id === id);
    return r ? mapSportLeague(r) : null;
  }
}

export async function createSportLeague(data: {
  stage: string; title: string; pointsEnabled: boolean;
  winPoints: number; drawPoints: number; lossPoints: number;
}): Promise<SportLeagueInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportLeague.create({ data: { ...data, status: 'setup' } });
    return mapSportLeague(r);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_LEAGUES, []);
    const newRec = {
      id: list.length > 0 ? Math.max(...list.map((l: any) => l.id)) + 1 : 1,
      ...data, status: 'setup', createdAt: new Date().toISOString(),
    };
    list.push(newRec);
    await writeJsonFile(FILE_SPORT_LEAGUES, list);
    return mapSportLeague(newRec);
  }
}

export async function updateSportLeague(id: number, patch: Partial<{
  title: string; status: string; pointsEnabled: boolean;
  winPoints: number; drawPoints: number; lossPoints: number;
}>): Promise<SportLeagueInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const r = await (prisma as any).sportLeague.update({ where: { id }, data: patch });
      return mapSportLeague(r);
    } catch { return null; }
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_LEAGUES, []);
    const idx = list.findIndex((l: any) => l.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    await writeJsonFile(FILE_SPORT_LEAGUES, list);
    return mapSportLeague(list[idx]);
  }
}

export async function deleteSportLeague(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const matches = await (prisma as any).sportMatch.findMany({ where: { leagueId: id } });
      for (const m of matches) {
        await (prisma as any).sportGoal.deleteMany({ where: { matchId: m.id } });
        await (prisma as any).sportCard.deleteMany({ where: { matchId: m.id } });
      }
      await (prisma as any).sportMatch.deleteMany({ where: { leagueId: id } });
      await (prisma as any).sportBehavior.deleteMany({ where: { leagueId: id } });
      await (prisma as any).sportLeague.delete({ where: { id } });
      return true;
    } catch { return false; }
  } else {
    const leagues = await readJsonFile<any[]>(FILE_SPORT_LEAGUES, []);
    const idx = leagues.findIndex((l: any) => l.id === id);
    if (idx === -1) return false;
    leagues.splice(idx, 1);
    await writeJsonFile(FILE_SPORT_LEAGUES, leagues);
    const allMatches = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    const matchIds = allMatches.filter((m: any) => m.leagueId === id).map((m: any) => m.id);
    await writeJsonFile(FILE_SPORT_MATCHES, allMatches.filter((m: any) => m.leagueId !== id));
    const goals = await readJsonFile<any[]>(FILE_SPORT_GOALS, []);
    await writeJsonFile(FILE_SPORT_GOALS, goals.filter((g: any) => !matchIds.includes(g.matchId)));
    const cards = await readJsonFile<any[]>(FILE_SPORT_CARDS, []);
    await writeJsonFile(FILE_SPORT_CARDS, cards.filter((c: any) => c.leagueId !== id));
    const behaviors = await readJsonFile<any[]>(FILE_SPORT_BEHAVIORS, []);
    await writeJsonFile(FILE_SPORT_BEHAVIORS, behaviors.filter((b: any) => b.leagueId !== id));
    return true;
  }
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────

export async function getSportMatches(leagueId: number): Promise<SportMatchInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await (prisma as any).sportMatch.findMany({
      where: { leagueId },
      orderBy: [{ matchday: 'asc' }, { id: 'asc' }],
    });
    return list.map(mapSportMatch);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    return list
      .filter((m: any) => m.leagueId === leagueId)
      .sort((a: any, b: any) => a.matchday - b.matchday || a.id - b.id)
      .map(mapSportMatch);
  }
}

export async function getSportMatchById(id: number): Promise<SportMatchInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportMatch.findUnique({ where: { id } });
    return r ? mapSportMatch(r) : null;
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    const r = list.find((m: any) => m.id === id);
    return r ? mapSportMatch(r) : null;
  }
}

export async function createSportMatch(data: {
  leagueId: number; matchday: number; homeGroupId: number; awayGroupId: number;
  matchDate?: string | null; notes?: string | null;
}): Promise<SportMatchInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportMatch.create({
      data: {
        ...data, homeScore: 0, awayScore: 0, status: 'scheduled',
        matchDate: data.matchDate ?? null, notes: data.notes ?? null
      },
    });
    return mapSportMatch(r);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    const newRec = {
      id: list.length > 0 ? Math.max(...list.map((m: any) => m.id)) + 1 : 1,
      leagueId: data.leagueId, matchday: data.matchday,
      homeGroupId: data.homeGroupId, awayGroupId: data.awayGroupId,
      matchDate: data.matchDate ?? null, notes: data.notes ?? null,
      homeScore: 0, awayScore: 0, status: 'scheduled', createdAt: new Date().toISOString(),
    };
    list.push(newRec);
    await writeJsonFile(FILE_SPORT_MATCHES, list);
    return mapSportMatch(newRec);
  }
}

export async function updateSportMatch(id: number, patch: Partial<{
  homeScore: number; awayScore: number; status: string;
  matchday: number; matchDate: string | null; notes: string | null;
}>): Promise<SportMatchInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const r = await (prisma as any).sportMatch.update({ where: { id }, data: patch });
      return mapSportMatch(r);
    } catch { return null; }
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    const idx = list.findIndex((m: any) => m.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    await writeJsonFile(FILE_SPORT_MATCHES, list);
    return mapSportMatch(list[idx]);
  }
}

export async function deleteSportMatch(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await (prisma as any).sportGoal.deleteMany({ where: { matchId: id } });
      await (prisma as any).sportCard.deleteMany({ where: { matchId: id } });
      await (prisma as any).sportMatch.delete({ where: { id } });
      return true;
    } catch { return false; }
  } else {
    const matches = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    const idx = matches.findIndex((m: any) => m.id === id);
    if (idx === -1) return false;
    matches.splice(idx, 1);
    await writeJsonFile(FILE_SPORT_MATCHES, matches);
    const goals = await readJsonFile<any[]>(FILE_SPORT_GOALS, []);
    await writeJsonFile(FILE_SPORT_GOALS, goals.filter((g: any) => g.matchId !== id));
    const cards = await readJsonFile<any[]>(FILE_SPORT_CARDS, []);
    await writeJsonFile(FILE_SPORT_CARDS, cards.filter((c: any) => c.matchId !== id));
    return true;
  }
}

// ─── GOALS ───────────────────────────────────────────────────────────────────

export async function getSportGoals(matchId: number): Promise<SportGoalInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await (prisma as any).sportGoal.findMany({
      where: { matchId }, orderBy: { createdAt: 'asc' },
    });
    return list.map(mapSportGoal);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_GOALS, []);
    return list.filter((g: any) => g.matchId === matchId).map(mapSportGoal);
  }
}

export async function getSportGoalsByLeague(leagueId: number): Promise<SportGoalInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const matches = await (prisma as any).sportMatch.findMany({ where: { leagueId }, select: { id: true } });
    const matchIds = matches.map((m: any) => m.id);
    if (!matchIds.length) return [];
    const list = await (prisma as any).sportGoal.findMany({
      where: { matchId: { in: matchIds } }, orderBy: { createdAt: 'asc' },
    });
    return list.map(mapSportGoal);
  } else {
    const allMatches = await readJsonFile<any[]>(FILE_SPORT_MATCHES, []);
    const matchIds = new Set(allMatches.filter((m: any) => m.leagueId === leagueId).map((m: any) => m.id));
    const list = await readJsonFile<any[]>(FILE_SPORT_GOALS, []);
    return list.filter((g: any) => matchIds.has(g.matchId)).map(mapSportGoal);
  }
}

export async function addSportGoal(data: {
  matchId: number; teamGroupId: number; scorerId?: number | null; scorerName: string; createdBy: string;
}): Promise<SportGoalInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportGoal.create({ data: { ...data, scorerId: data.scorerId ?? null } });
    return mapSportGoal(r);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_GOALS, []);
    const newRec = {
      id: list.length > 0 ? Math.max(...list.map((g: any) => g.id)) + 1 : 1,
      ...data, scorerId: data.scorerId ?? null, createdAt: new Date().toISOString(),
    };
    list.push(newRec);
    await writeJsonFile(FILE_SPORT_GOALS, list);
    return mapSportGoal(newRec);
  }
}

export async function deleteSportGoal(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try { await (prisma as any).sportGoal.delete({ where: { id } }); return true; }
    catch { return false; }
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_GOALS, []);
    const idx = list.findIndex((g: any) => g.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(FILE_SPORT_GOALS, list);
    return true;
  }
}

// ─── CARDS ───────────────────────────────────────────────────────────────────

export async function getSportCards(filter: { matchId?: number; leagueId?: number }): Promise<SportCardInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await (prisma as any).sportCard.findMany({
      where: filter, orderBy: { createdAt: 'asc' },
    });
    return list.map(mapSportCard);
  } else {
    let list = await readJsonFile<any[]>(FILE_SPORT_CARDS, []);
    if (filter.matchId !== undefined) list = list.filter((c: any) => c.matchId === filter.matchId);
    if (filter.leagueId !== undefined) list = list.filter((c: any) => c.leagueId === filter.leagueId);
    return list.map(mapSportCard);
  }
}

export async function addSportCard(data: {
  matchId: number; leagueId: number; studentId: number; studentName: string;
  groupId: number; cardType: string; suspensionMatches: number; createdBy: string;
}): Promise<SportCardInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportCard.create({ data: { ...data, suspensionServed: false } });
    return mapSportCard(r);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_CARDS, []);
    const newRec = {
      id: list.length > 0 ? Math.max(...list.map((c: any) => c.id)) + 1 : 1,
      ...data, suspensionServed: false, createdAt: new Date().toISOString(),
    };
    list.push(newRec);
    await writeJsonFile(FILE_SPORT_CARDS, list);
    return mapSportCard(newRec);
  }
}

export async function updateSportCard(id: number, patch: { suspensionServed?: boolean; suspensionMatches?: number; punishedAt?: string | null }): Promise<SportCardInfo | null> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      const r = await (prisma as any).sportCard.update({ where: { id }, data: patch });
      return mapSportCard(r);
    } catch { return null; }
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_CARDS, []);
    const idx = list.findIndex((c: any) => c.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    await writeJsonFile(FILE_SPORT_CARDS, list);
    return mapSportCard(list[idx]);
  }
}

export async function deleteSportCard(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try { await (prisma as any).sportCard.delete({ where: { id } }); return true; }
    catch { return false; }
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_CARDS, []);
    const idx = list.findIndex((c: any) => c.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(FILE_SPORT_CARDS, list);
    return true;
  }
}

// ─── BEHAVIORS ───────────────────────────────────────────────────────────────

export async function getSportBehaviors(leagueId: number): Promise<SportBehaviorInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await (prisma as any).sportBehavior.findMany({
      where: { leagueId }, orderBy: { createdAt: 'desc' },
    });
    return list.map(mapSportBehavior);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_BEHAVIORS, []);
    return list.filter((b: any) => b.leagueId === leagueId)
      .sort((a: any, b: any) => b.id - a.id).map(mapSportBehavior);
  }
}

export async function addSportBehavior(data: {
  leagueId: number; matchId?: number | null; studentId: number; studentName: string;
  groupId: number; type: string; description: string; createdBy: string;
}): Promise<SportBehaviorInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const r = await (prisma as any).sportBehavior.create({
      data: { ...data, matchId: data.matchId ?? null },
    });
    return mapSportBehavior(r);
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_BEHAVIORS, []);
    const newRec = {
      id: list.length > 0 ? Math.max(...list.map((b: any) => b.id)) + 1 : 1,
      ...data, matchId: data.matchId ?? null, createdAt: new Date().toISOString(),
    };
    list.push(newRec);
    await writeJsonFile(FILE_SPORT_BEHAVIORS, list);
    return mapSportBehavior(newRec);
  }
}

export async function deleteSportBehavior(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try { await (prisma as any).sportBehavior.delete({ where: { id } }); return true; }
    catch { return false; }
  } else {
    const list = await readJsonFile<any[]>(FILE_SPORT_BEHAVIORS, []);
    const idx = list.findIndex((b: any) => b.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(FILE_SPORT_BEHAVIORS, list);
    return true;
  }
}

// ─── STANDINGS ───────────────────────────────────────────────────────────────

export async function getLeagueStandings(leagueId: number): Promise<SportStanding[]> {
  const league = await getSportLeagueById(leagueId);
  const matches = await getSportMatches(leagueId);
  const win = league?.winPoints ?? 2;
  const draw = league?.drawPoints ?? 1;
  const loss = league?.lossPoints ?? 0;

  const map = new Map<number, SportStanding>();
  const ensure = (gid: number) => {
    if (!map.has(gid)) {
      map.set(gid, { groupId: gid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 });
    }
    return map.get(gid)!;
  };

  for (const m of matches) { ensure(m.homeGroupId); ensure(m.awayGroupId); }

  for (const m of matches.filter(m => m.status === 'finished')) {
    const home = ensure(m.homeGroupId);
    const away = ensure(m.awayGroupId);
    home.played++; away.played++;
    home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.won++; home.points += win; away.lost++; away.points += loss;
    } else if (m.homeScore < m.awayScore) {
      away.won++; away.points += win; home.lost++; home.points += loss;
    } else {
      home.drawn++; home.points += draw; away.drawn++; away.points += draw;
    }
  }

  for (const [, s] of map) s.goalDiff = s.goalsFor - s.goalsAgainst;
  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });
}

// ─── COLLECTIVE POINTS FOR MATCH RESULT ──────────────────────────────────────

export async function applyMatchCollectivePoints(
  match: SportMatchInfo,
  league: SportLeagueInfo,
  operation: 'add' | 'remove' | 'replace',
  recordedBy: string
): Promise<void> {
  const REASON_PREFIX = `دوري رياضي | match:${match.id}`;

  if (operation === 'remove' || operation === 'replace') {
    if (hasDatabase) {
      const prisma = getPrisma()!;
      await (prisma as any).point.deleteMany({
        where: { category: 'sports', reason: { startsWith: REASON_PREFIX } },
      });
    } else {
      const pts = await readJsonFile<PointInfo[]>(FILE_POINTS, []);
      await writeJsonFile(FILE_POINTS, pts.filter(p => !(p.category === 'sports' && p.reason.startsWith(REASON_PREFIX))));
    }
  }
  if (operation === 'remove') return;
  if (!league.pointsEnabled || match.status !== 'finished') return;

  const students = await getStudents();
  const homeStudents = students.filter(s => s.groupId === match.homeGroupId);
  const awayStudents = students.filter(s => s.groupId === match.awayGroupId);

  let homePts = 0, awayPts = 0, homeReason = '', awayReason = '';
  if (match.homeScore > match.awayScore) {
    homePts = league.winPoints; homeReason = `${REASON_PREFIX} | فوز`;
    awayPts = league.lossPoints; awayReason = `${REASON_PREFIX} | خسارة`;
  } else if (match.homeScore < match.awayScore) {
    awayPts = league.winPoints; awayReason = `${REASON_PREFIX} | فوز`;
    homePts = league.lossPoints; homeReason = `${REASON_PREFIX} | خسارة`;
  } else {
    homePts = league.drawPoints; homeReason = `${REASON_PREFIX} | تعادل`;
    awayPts = league.drawPoints; awayReason = `${REASON_PREFIX} | تعادل`;
  }

  const toAdd: Array<{ registrationId: number; delta: number; reason: string }> = [];
  if (homePts > 0) for (const s of homeStudents) toAdd.push({ registrationId: s.id, delta: homePts, reason: homeReason });
  if (awayPts > 0) for (const s of awayStudents) toAdd.push({ registrationId: s.id, delta: awayPts, reason: awayReason });

  for (const item of toAdd) {
    await addPointsRecord({
      registrationId: item.registrationId, delta: item.delta, reason: item.reason,
      category: 'sports', pointType: 'collective', recordedBy,
    });
  }
}
