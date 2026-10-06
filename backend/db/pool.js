import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oor_market',
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});