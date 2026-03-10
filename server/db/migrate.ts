import { pool, query } from './index'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations', 'sql')

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<{ name: string }>('SELECT name FROM _migrations ORDER BY id')
  return new Set(result.rows.map((r) => r.name))
}

export async function migrate() {
  await ensureMigrationsTable()
  const applied = await getAppliedMigrations()

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
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`  ✓ ${file}`)
      count++
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
