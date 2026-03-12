import { pool, query } from './index'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations', 'sql')
const NEW_TABLE = 'sys_migrations'
const OLD_TABLE = '_migrations'

async function ensureMigrationsTable() {
  // Check if new table exists (post-016)
  const check = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${NEW_TABLE}'
    ) AS exists
  `)
  if (check.rows[0]?.exists) return NEW_TABLE

  // Check if old table exists (pre-016)
  const checkOld = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${OLD_TABLE}'
    ) AS exists
  `)
  if (checkOld.rows[0]?.exists) return OLD_TABLE

  // Neither exists — create new table
  await query(`
    CREATE TABLE ${NEW_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  return NEW_TABLE
}

async function getAppliedMigrations(table: string): Promise<Set<string>> {
  const result = await query<{ name: string }>(`SELECT name FROM ${table} ORDER BY id`)
  return new Set(result.rows.map((r) => r.name))
}

export async function migrate() {
  let table = await ensureMigrationsTable()
  const applied = await getAppliedMigrations(table)

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue

    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(`INSERT INTO ${table} (name) VALUES ($1)`, [file])
      await client.query('COMMIT')
      console.log(`  ✓ ${file}`)
      count++

      // After applying 016, rename _migrations → sys_migrations
      if (file === '016_table_prefix_convention.sql' && table === OLD_TABLE) {
        await client.query(`ALTER TABLE ${OLD_TABLE} RENAME TO ${NEW_TABLE}`)
        table = NEW_TABLE
        console.log(`  ✓ Renamed ${OLD_TABLE} → ${NEW_TABLE}`)
      }
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`  ✗ ${file}:`, err)
      throw err
    } finally {
      client.release()
    }
  }

  if (count === 0) {
    console.log('  No new migrations.')
  } else {
    console.log(`  Applied ${count} migration(s).`)
  }
}

// Run directly: bun run server/db/migrate.ts
if (import.meta.main) {
  console.log('Running migrations...')
  migrate()
    .then(() => {
      console.log('Done.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
