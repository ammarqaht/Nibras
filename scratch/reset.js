const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup process...');

  // 1. Reset database tables and sequences
  try {
    console.log('Trancating Database tables...');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Submission" CASCADE;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Point" CASCADE;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Attendance" CASCADE;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Registration" RESTART IDENTITY CASCADE;');
    console.log('✅ PostgreSQL tables successfully truncated and sequences restarted.');
  } catch (err) {
    console.warn('⚠️ Database reset failed (or DATABASE_URL not active):', err.message);
  }

  // 2. Clear local JSON fallback files
  console.log('Clearing local JSON files...');
  const dataDir = path.join(__dirname, '..', '.data');
  const filesToClear = [
    { name: 'registrations.json', default: '[]' },
    { name: 'membership-counter.json', default: '{"count":0}' },
    { name: 'points.json', default: '[]' },
    { name: 'attendance.json', default: '[]' },
    { name: 'submissions.json', default: '[]' }
  ];

  for (const f of filesToClear) {
    const filePath = path.join(dataDir, f.name);
    try {
      if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, f.default, 'utf8');
        console.log(`- Cleared: ${f.name}`);
      } else {
        // If file doesn't exist, create it anyway
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(filePath, f.default, 'utf8');
        console.log(`- Created fresh: ${f.name}`);
      }
    } catch (err) {
      console.error(`- Error handling file ${f.name}:`, err.message);
    }
  }

  console.log('🎉 Cleanup process completed successfully.');
}

main()
  .catch(err => {
    console.error('❌ Reset script crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
