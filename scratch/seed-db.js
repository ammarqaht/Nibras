const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  const dummyHash = hashPassword('a');

  const dummySupervisors = [
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
    { email: '11', role: 'administrative_supervisor', name: 'تجربة مشرف إدارية' }
  ];

  console.log('Seeding database...');
  
  for (const d of dummySupervisors) {
    try {
      await prisma.supervisor.upsert({
        where: { email: d.email },
        update: { passwordHash: dummyHash, role: d.role, name: d.name, passwordPlain: 'a' },
        create: {
          name: d.name,
          email: d.email,
          passwordHash: dummyHash,
          role: d.role,
          groupIds: '',
          departments: '',
          stage: '',
          passwordPlain: 'a'
        }
      });
      console.log(`Seeded DB account: ${d.email} (${d.role})`);
    } catch (err) {
      console.error(`Failed to seed DB account ${d.email}:`, err.message);
    }
  }

  // Also seed JSON file fallback if needed
  const DATA_DIR = path.join(__dirname, '..', '.data');
  const FILE_SUPERVISORS = path.join(DATA_DIR, 'supervisors.json');
  
  console.log('Seeding local JSON fallback...');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    let supervisors = [];
    if (fs.existsSync(FILE_SUPERVISORS)) {
      const raw = fs.readFileSync(FILE_SUPERVISORS, 'utf8');
      supervisors = JSON.parse(raw);
    }

    const upsertJson = (email, role, name, hash) => {
      const idx = supervisors.findIndex(s => s.email === email);
      if (idx !== -1) {
        supervisors[idx].passwordHash = hash;
        supervisors[idx].role = role;
        supervisors[idx].name = name;
        supervisors[idx].passwordPlain = 'a';
      } else {
        supervisors.push({
          id: supervisors.length > 0 ? Math.max(...supervisors.map(s => s.id)) + 1 : 1,
          name,
          email,
          passwordHash: hash,
          role,
          groupIds: '',
          departments: '',
          stage: '',
          passwordPlain: 'a',
          createdAt: new Date().toISOString()
        });
      }
    };

    for (const d of dummySupervisors) {
      upsertJson(d.email, d.role, d.name, dummyHash);
    }

    fs.writeFileSync(FILE_SUPERVISORS, JSON.stringify(supervisors, null, 2), 'utf8');
    console.log('Seeded local JSON file successfully!');
  } catch (err) {
    console.error('Failed to seed JSON file:', err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
