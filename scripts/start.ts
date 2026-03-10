/**
 * Production startup script: runs migrations then starts Astro server.
 */

import { pool } from '../server/db/index'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'server', 'db', 'migrations', 'sql')

async function runMigrations() {
  console.log('[start] Running database migrations...')

  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const applied = await pool.query<{ name: string }>('SELECT name FROM _migrations ORDER BY name')
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
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
    console.log(`[start] Applied: ${file}`)
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
