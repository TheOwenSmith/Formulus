import { PrismaClient } from '@api/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from './config';

declare global {
  var prisma: PrismaClient | undefined;
  var pgPool: Pool | undefined;
}

globalThis.pgPool ??= new Pool({
  connectionString: config.getKey('DATABASE_URL'),
});

globalThis.prisma ??= new PrismaClient({
  adapter: new PrismaPg(globalThis.pgPool),
  log: ['warn', 'error'],
});

export const prisma = globalThis.prisma;
