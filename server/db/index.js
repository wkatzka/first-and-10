/**
 * Postgres connection pool
 * ========================
 * Used when DATABASE_URL is set (replaces JSON file storage)
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const usePostgres = !!connectionString;

let pool = null;

if (usePostgres) {
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('Postgres pool error:', err);
  });
}

async function query(text, params) {
  if (!pool) throw new Error('Postgres not configured (DATABASE_URL)');
  return pool.query(text, params);
}

async function transaction(callback) {
  if (!pool) throw new Error('Postgres not configured (DATABASE_URL)');
  const client = await pool.connect();
  try {
    const result = await callback(client);
    return result;
  } finally {
    client.release();
  }
}

async function testConnection() {
  if (!pool) return false;
  try {
    const res = await pool.query('SELECT 1');
    return !!res.rows;
  } catch (err) {
    console.error('Postgres connection test failed:', err.message);
    return false;
  }
}

function useDatabase() {
  return usePostgres;
}

module.exports = {
  query,
  transaction,
  testConnection,
  useDatabase,
  pool,
};
