-- Migration 1: Initial schema (idempotent - safe if already applied)
-- Tables already exist in your DB; this is for fresh installs.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core tables created by initial setup; migrator only ensures schema_migrations exists.
