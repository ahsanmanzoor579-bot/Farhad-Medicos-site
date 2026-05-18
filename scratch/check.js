const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.batch.count();
  console.log('Total Batches in DB:', count);
  const meds = await prisma.medicine.count();
  console.log('Total Medicines in DB:', meds);
}

check().catch(console.error).finally(() => prisma.$disconnect());
