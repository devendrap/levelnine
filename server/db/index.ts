import pg from 'pg'

// Validate required env vars in production
if (process.env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET']
  const missing = required.filter(k => !process.env[k])
  if (missing.length > 0) {
    console.error(`[db] Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
}

const pool = new pg.Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  user: process.env.DB_USER ?? 'aiui',
  password: process.env.DB_PASSWORD ?? 'aiui_dev',
  database: process.env.DB_NAME ?? 'aiui',
  max: 20,
  idleTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err)
})

export { pool }

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function getClient() {
  const client = await pool.connect()
  return client
}

export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
