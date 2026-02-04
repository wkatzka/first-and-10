/**
 * Run Postgres migrations
 * ========================
 * Requires DATABASE_URL. Run: node db/migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { query, transaction, testConnection } = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const ok = await testConnection();
  if (!ok) {
    console.error('Could not connect');
    process.exit(1);
  }
  console.log('Connected successfully');

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  let applied = 0;

  for (const file of files) {
    const name = file.replace(/\.sql$/, '');
    const res = await query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (res.rows.length > 0) {
      console.log('  ✓', name, '(already applied)');
      continue;
    }

    console.log('  → Applying', name, '...');
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    await transaction(async (client) => {
      await client.query(sql);
    });
    await query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    applied++;
    console.log('  ✓', name, 'applied');
  }

  console.log(applied ? `\nMigrations complete! (${applied} applied)` : '\nMigrations complete!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
