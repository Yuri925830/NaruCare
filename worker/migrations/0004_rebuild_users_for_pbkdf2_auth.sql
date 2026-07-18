-- Migration number: 0004 	 2026-07-18T14:14:25.243Z

-- The production D1 database previously used a legacy authentication schema.
-- Its test accounts are backed up and removed before this migration is applied.
PRAGMA defer_foreign_keys = ON;

DROP INDEX IF EXISTS idx_users_account_id_lower;
DROP TABLE users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_account_id_lower
  ON users(lower(account_id));

PRAGMA defer_foreign_keys = OFF;
