/**
 * Reset a dev user's password to "password" (same hash as server uses).
 * Usage: node reset-dev-password.js [username]
 * Example: node reset-dev-password.js TestUser1
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const crypto = require('crypto');
const db = require('./db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  const username = process.argv[2] || 'TestUser1';
  if (!db.useDatabase()) {
    console.log('DATABASE_URL is not set.');
    process.exit(1);
  }
  const hash = hashPassword('password');
  const r = await db.query(
    'UPDATE users SET password_hash = $1 WHERE LOWER(username) = LOWER($2) RETURNING id, username',
    [hash, username]
  );
  if (r.rowCount === 0) {
    console.log(`No user found with username "${username}".`);
  } else {
    console.log(`Password for ${r.rows[0].username} reset to "password".`);
  }
  if (db.pool) await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
