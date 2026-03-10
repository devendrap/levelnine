import type { APIRoute } from 'astro'
import { pool } from '../../../server/db/index'

export const GET: APIRoute = async () => {
  try {
    const result = await pool.query('SELECT 1 AS ok')
    return Response.json({
      status: 'ok',
      db: result.rows[0]?.ok === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return Response.json(
      { status: 'error', db: 'disconnected', error: err.message },
      { status: 503 },
    )
  }
}
