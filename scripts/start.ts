/**
 * Production startup script: runs migrations then starts Astro server.
 */

import { pool } from '../server/db/index'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'server', 'db', 'migrations', 'sql')
const NEW_TABLE = 'sys_migrations'
const OLD_TABLE = '_migrations'

async function runMigrations() {
  console.log('[start] Running database migrations...')

  // Check which migrations table exists
  const checkNew = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${NEW_TABLE}'
    ) AS exists
  `)
  const checkOld = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${OLD_TABLE}'
    ) AS exists
  `)

  let table: string
  if (checkNew.rows[0]?.exists) {
    table = NEW_TABLE
  } else if (checkOld.rows[0]?.exists) {
    table = OLD_TABLE
  } else {
    await pool.query(`
      CREATE TABLE ${NEW_TABLE} (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    table = NEW_TABLE
  }

  const applied = await pool.query<{ name: string }>(`SELECT name FROM ${table} ORDER BY name`)
  const appliedSet = new Set(applied.rows.map(r => r.name))

  let files: string[]
  try {
    files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort()
  } catch {
    console.log('[start] No migrations directory found, skipping.')
    return
  }

  for (const file of files) {
    if (appliedSet.has(file)) continue
    console.log(`[start] Applying migration: ${file}`)
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
    await pool.query(sql)
    await pool.query(`INSERT INTO ${table} (name) VALUES ($1)`, [file])
    console.log(`[start] Applied: ${file}`)

    // After applying 016, rename _migrations → sys_migrations
    if (file === '016_table_prefix_convention.sql' && table === OLD_TABLE) {
      await pool.query(`ALTER TABLE ${OLD_TABLE} RENAME TO ${NEW_TABLE}`)
      table = NEW_TABLE
      console.log(`[start] Renamed ${OLD_TABLE} → ${NEW_TABLE}`)
    }
  }

  console.log('[start] Migrations complete.')
}

async function startServer() {
  // Astro standalone adapter outputs an entry server
  const entry = join(import.meta.dir, '..', 'dist', 'server', 'entry.mjs')
  console.log('[start] Starting Astro server...')
  await import(entry)
}

async function main() {
  try {
    await runMigrations()
  } catch (err) {
    console.error('[start] Migration failed:', err)
    process.exit(1)
  }

  try {
    await startServer()
  } catch (err) {
    console.error('[start] Server failed to start:', err)
    process.exit(1)
  }
}

main()
