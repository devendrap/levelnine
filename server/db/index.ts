import pg from 'pg'
import { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } from 'astro:env/server'

const pool = new pg.Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
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
