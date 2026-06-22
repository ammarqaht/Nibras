import { promises as fs } from 'fs';
import path from 'path';
import { getPrisma, hasDatabase } from './db';
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

export type ScheduleInfo = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  supervisorId: number;
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

  if (databaseAvailable) {
    try {
      const prisma = getPrisma()!;
      
      // Seed/Update 'admin'
      await prisma.supervisor.upsert({
        where: { email: 'admin' },
        update: { passwordHash: defaultHash, role: 'admin', name: 'المدير العام' },
        create: {
          name: 'المدير العام',
          email: 'admin',
          passwordHash: defaultHash,
          role: 'admin',
          groupIds: ''
        }
      });

      // Seed/Update 'admin@nibras.com'
      await prisma.supervisor.upsert({
        where: { email: 'admin@nibras.com' },
        update: { passwordHash: defaultHash, role: 'admin', name: 'المدير العام' },
        create: {
          name: 'المدير العام',
          email: 'admin@nibras.com',
          passwordHash: defaultHash,
          role: 'admin',
          groupIds: ''
        }
      });
    } catch (err) {
      console.error("Database seed failed, disabling DB client and falling back to JSON:", err);
      databaseAvailable = false;
    }
  }

  if (!databaseAvailable) {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    
    // Update or add 'admin'
    const adminIndex = supervisors.findIndex(s => s.email === 'admin');
    if (adminIndex !== -1) {
      supervisors[adminIndex].passwordHash = defaultHash;
      supervisors[adminIndex].role = 'admin';
    } else {
      supervisors.push({
        id: supervisors.length + 1,
        name: 'المدير العام',
        email: 'admin',
        passwordHash: defaultHash,
        role: 'admin',
        groupIds: '',
        departments: '',
        createdAt: new Date().toISOString()
      });
    }

    // Update or add 'admin@nibras.com'
    const adminEmailIndex = supervisors.findIndex(s => s.email === 'admin@nibras.com');
    if (adminEmailIndex !== -1) {
      supervisors[adminEmailIndex].passwordHash = defaultHash;
      supervisors[adminEmailIndex].role = 'admin';
    } else {
      supervisors.push({
        id: supervisors.length + 1,
        name: 'المدير العام',
        email: 'admin@nibras.com',
        passwordHash: defaultHash,
        role: 'admin',
        groupIds: '',
        departments: '',
        createdAt: new Date().toISOString()
      });
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
        createdAt: sup.createdAt.toISOString()
      };
    } catch (err) {
      console.error("Database query failed, falling back to JSON:", err);
      databaseAvailable = false;
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
        customPermissions: data.customPermissions
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
  if (data.password) updateData.passwordHash = hashPassword(data.password);

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

    list[index] = updated;
    await writeJsonFile(FILE_SUPERVISORS, list);
    return updated;
  }
}

// ==================== STUDENT / REGISTRATION SERVICES ====================
export async function getStudents(): Promise<StudentInfo[]> {
  if (hasDatabase) {
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
  } else {
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
        recordedBy: data.recordedBy
      }
    });
    return {
      id: p.id,
      registrationId: p.registrationId,
      delta: p.delta,
      reason: p.reason,
      category: p.category,
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
    const prisma = getPrisma()!;
    const list = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    return map;
  } else {
    return readJsonFile<Record<string, string>>(FILE_SETTINGS, {});
  }
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
  dueDate: string;
  createdAt: string;
  track: string | null;
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
      dueDate: t.dueDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
      track: t.track,
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
      dueDate: String(t.dueDate),
      createdAt: String(t.createdAt || new Date().toISOString()),
      track: t.track || 'عام',
      isActive: t.isActive !== false,
      submissionMethod: t.submissionMethod || 'رفع ملف',
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
        dueDate: new Date(task.dueDate),
        track: task.track,
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
    'title', 'description', 'maxPoints', 'dueDate', 'track', 'isActive',
    'submissionMethod', 'assignedAdmins', 'imageUrl', 'resourceLink', 'visibility', 'visibleToIds'
  ] as const;

  for (const k of allowedKeys) {
    if (patch[k] !== undefined) dbData[k] = patch[k];
  }
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
        dueDate: updated.dueDate.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        track: updated.track,
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
      createdAt: s.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<ScheduleInfo[]>(FILE_SCHEDULES, []);
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
        supervisorId: data.supervisorId
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
      createdAt: s.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<ScheduleInfo[]>(FILE_SCHEDULES, []);
    const newSchedule: ScheduleInfo = {
      id: crypto.randomUUID(),
      ...data,
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
