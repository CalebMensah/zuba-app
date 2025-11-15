// clearUsers.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearUsers() {
  try {
    await prisma.user.deleteMany({});
    console.log('✅ All users deleted successfully.');
  } catch (error) {
    console.error('❌ Error deleting users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearUsers();