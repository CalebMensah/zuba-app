import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

// Create a new pool using the connection string
const pool = new Pool({ connectionString });

// Create the PrismaPg adapter
const adapter = new PrismaPg(pool);

// Instantiate Prisma Client with the adapter
const prisma = new PrismaClient({ adapter });

export default prisma;
