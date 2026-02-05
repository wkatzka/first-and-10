/**
 * Dev seed: add TestUser1 and TestUser2 to preregistered_users so you can claim accounts in the app.
 * Run from server dir: node seed-dev.js   or: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const db = require('./db');

const DEV_USERS = [
  { username: 'TestUser1', max_packs: 13 },
  { username: 'TestUser2', max_packs: 0 },
];

async function seed() {
  if (!db.useDatabase()) {
    console.log('DATABASE_URL is not set. Skipping seed.');
    process.exit(0);
    return;
  }

  try {
    for (const { username, max_packs } of DEV_USERS) {
      try {
        await db.query('INSERT INTO preregistered_users (username, max_packs) VALUES ($1, $2)', [
          username,
          max_packs,
        ]);
        console.log(`${username} added to preregistered_users.`);
      } catch (err) {
        if (err.code === '42P01') {
          console.error('Table preregistered_users does not exist. Run migrations first (e.g. npm run migrate).');
          process.exit(1);
        }
        if (err.code === '23505') {
          console.log(`${username} already in preregistered_users.`);
        } else {
          throw err;
        }
      }
      // Ensure max_packs is applied to existing rows (preregistered and claimed users)
      await db.query(
        'UPDATE preregistered_users SET max_packs = $1 WHERE LOWER(username) = LOWER($2)',
        [max_packs, username]
      );
      const u = await db.query(
        'UPDATE users SET max_packs = $1 WHERE LOWER(username) = LOWER($2) RETURNING id',
        [max_packs, username]
      );
      if (u.rowCount > 0) {
        console.log(`${username} max_packs set to ${max_packs} in users.`);
      }
    }
  } finally {
    if (db.pool) await db.pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
