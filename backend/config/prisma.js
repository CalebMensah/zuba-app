import pkg from '@prisma/client';
const { PrismaClient } = pkg;

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from the backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible locations for .env file
const possibleEnvPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '.env'),
  '.env'
];

// Load dotenv from the first file that exists
let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Loaded environment variables from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (err) {
    console.log(`Could not load from ${envPath}:`, err.message);
  }
}

// If no .env file was found, try default config
if (!envLoaded) {
  dotenv.config();
  console.log('Loaded environment variables from default location');
}

// Check if DATABASE_URL is available
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(' DATABASE_URL environment variable is not set');
  console.log('Available environment variables:', Object.keys(process.env).filter(key => 
    key.includes('DATABASE') || key.includes('DB') || key.includes('POSTGRES')
  ));
  throw new Error('DATABASE_URL environment variable is not set');
}

console.log('Database URL loaded successfully');

// Create PostgreSQL pool
const pool = new pg.Pool({
  connectionString,
});

// Create adapter
const adapter = new PrismaPg(pool);

// Create Prisma client with adapter
const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
});

// Test the connection
async function testConnection() {
  try {
    await prisma.$connect();
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
}

// Test connection on initialization
testConnection().catch(console.error);

export default prisma;