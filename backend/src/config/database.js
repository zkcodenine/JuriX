const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
  // Connection pool settings for remote databases (Supabase, managed PG)
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function connectDatabase() {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      logger.warn(`Tentativa ${attempt}/${maxRetries} de conexão ao banco falhou: ${err.message}`);
      if (attempt === maxRetries) throw err;
      // Exponential backoff: 2s, 4s, 8s, 16s
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
  }
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
