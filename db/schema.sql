-- HyperDrive waitlist schema (PostgreSQL 12+).
-- The app creates this automatically on first use (lib/db.ts); this file is the
-- reference copy, e.g. for running by hand:  psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,   -- stored trimmed + lower-cased
  providers   TEXT[]      NOT NULL,          -- google-drive | dropbox | onedrive
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Handy queries:
--   SELECT count(*) FROM waitlist_entries;
--   SELECT email, providers, created_at FROM waitlist_entries ORDER BY id;
--   \copy (SELECT email, array_to_string(providers, ';') AS providers, created_at FROM waitlist_entries ORDER BY id) TO 'waitlist.csv' CSV HEADER
