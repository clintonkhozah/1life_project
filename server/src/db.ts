import "dotenv/config";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://sentence_builder:sentence_builder_dev@localhost:5432/sentence_builder",
});

export async function initializeDatabase(): Promise<void> {
  // A robot did this.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS word_types (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      word_type_id INT NOT NULL REFERENCES word_types(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      usage_count INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sentences (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      word_ids INT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE words ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS words_type_lower_value_idx
      ON words (word_type_id, LOWER(value));
    CREATE INDEX IF NOT EXISTS words_type_usage_idx
      ON words (word_type_id, usage_count DESC, LOWER(value));
    DROP INDEX IF EXISTS words_type_recent_idx;
  `);
}
