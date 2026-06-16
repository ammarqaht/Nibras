import { promises as fs } from 'fs';
import path from 'path';
import { getPrisma, hasDatabase } from './db';
import crypto from 'crypto';

export type SupervisorInfo = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  groupIds: string;
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
  createdAt: string;
};

export type SettingInfo = {
  key: string;
  value: string; // JSON string
};

// Standard SHA256 hashing for secure passwords without extra dependencies
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Local fallback files paths
const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_REGISTRATIONS = path.join(DATA_DIR, 'registrations.json');
const FILE_SUPERVISORS = path.join(DATA_DIR, 'supervisors.json');
const FILE_ATTENDANCE = path.join(DATA_DIR, 'attendance.json');
const FILE_POINTS = path.join(DATA_DIR, 'points.json');
const FILE_GROUPS = path.join(DATA_DIR, 'groups.json');
const FILE_ANNOUNCEMENTS = path.join(DATA_DIR, 'announcements.json');
const FILE_SETTINGS = path.join(DATA_DIR, 'settings.json');

async function readJsonFile<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Ensure default Admin supervisor is seeded
export async function seedDefaultAdminIfNeeded(): Promise<void> {
  const adminEmail = 'admin@nibras.com';
  const defaultHash = hashPassword('admin123');

  if (hasDatabase) {
    const prisma = getPrisma()!;
    const existing = await prisma.supervisor.findUnique({
      where: { email: adminEmail }
    });
    if (!existing) {
      await prisma.supervisor.create({
        data: {
          name: 'المدير العام',
          email: adminEmail,
          passwordHash: defaultHash,
          role: 'admin',
          groupIds: ''
        }
      });
    }
  } else {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    const exists = supervisors.some(s => s.email === adminEmail);
    if (!exists) {
      supervisors.push({
        id: supervisors.length + 1,
        name: 'المدير العام',
        email: adminEmail,
        passwordHash: defaultHash,
        role: 'admin',
        groupIds: '',
        createdAt: new Date().toISOString()
      });
      await writeJsonFile(FILE_SUPERVISORS, supervisors);
    }
  }
}

// ==================== SUPERVISOR SERVICES ====================
export async function getSupervisorByEmail(email: string): Promise<SupervisorInfo | null> {
  await seedDefaultAdminIfNeeded();
  if (hasDatabase) {
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
      createdAt: sup.createdAt.toISOString()
    };
  } else {
    const supervisors = await readJsonFile<SupervisorInfo[]>(FILE_SUPERVISORS, []);
    return supervisors.find(s => s.email === email) || null;
  }
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
        groupIds: data.groupIds
      }
    });
    return {
      id: sup.id,
      name: sup.name,
      email: sup.email,
      passwordHash: sup.passwordHash,
      role: sup.role,
      groupIds: sup.groupIds,
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
      registrationStatus: r.registrationStatus
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
      registrationStatus: r.registrationStatus || 'pending'
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
        registrationStatus: data.registrationStatus
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
      registrationStatus: updated.registrationStatus
    };
  } else {
    const list = await getStudents();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return null;
    const updated = {
      ...list[index],
      ...data
    };
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

// ==================== ANNOUNCEMENTS SERVICES ====================
export async function getAnnouncements(): Promise<AnnouncementInfo[]> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const list = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return list.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      createdAt: a.createdAt.toISOString()
    }));
  } else {
    return readJsonFile<AnnouncementInfo[]>(FILE_ANNOUNCEMENTS, []);
  }
}

export async function createAnnouncement(title: string, body: string, audience: string): Promise<AnnouncementInfo> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    const a = await prisma.announcement.create({
      data: { title, body, audience }
    });
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      createdAt: a.createdAt.toISOString()
    };
  } else {
    const list = await readJsonFile<AnnouncementInfo[]>(FILE_ANNOUNCEMENTS, []);
    const newAnnounce: AnnouncementInfo = {
      id: list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1,
      title,
      body,
      audience,
      createdAt: new Date().toISOString()
    };
    list.push(newAnnounce);
    await writeJsonFile(FILE_ANNOUNCEMENTS, list);
    return newAnnounce;
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

import { site as origSite, landing as origLanding, clubDetails as origClubDetails, footer as origFooter } from '../content';

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

  return { site, landing, clubDetails, footer };
}

export async function deleteStudent(id: number): Promise<boolean> {
  if (hasDatabase) {
    const prisma = getPrisma()!;
    try {
      await prisma.registration.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  } else {
    const list = await getStudents();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    await writeJsonFile(FILE_REGISTRATIONS, list);
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
