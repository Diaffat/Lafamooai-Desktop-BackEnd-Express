// test.js - Prisma ORM test
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma connection...');
  
  try {
    // Count existing users
    const count = await prisma.customUser.count();
    console.log('Existing users:', count);
    
    // Create a new user
    const user = await prisma.customUser.create({
      data: {
        username: "alice2",
        email: "alice2@example.com",
        password: "1234",
      },
    });
    console.log('Created user:', user);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();