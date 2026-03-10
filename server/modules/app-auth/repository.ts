import { query } from '../../db/index'
import type { AppUser } from '../../core/types/index'

export async function findByEmail(email: string, containerId: string): Promise<AppUser | null> {
  const result = await query<AppUser>(
    'SELECT * FROM app_users WHERE email = $1 AND container_id = $2',
    [email, containerId],
  )
  return result.rows[0] ?? null
}

export async function findById(id: string): Promise<AppUser | null> {
  const result = await query<AppUser>('SELECT * FROM app_users WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function findByContainer(containerId: string): Promise<AppUser[]> {
  const result = await query<AppUser>(
    'SELECT * FROM app_users WHERE container_id = $1 ORDER BY created_at DESC',
    [containerId],
  )
  return result.rows
}

export async function insert(data: {
  container_id: string
  email: string
  name: string
  password_hash: string
  role?: string
  invited_by?: string
}): Promise<AppUser> {
  const result = await query<AppUser>(
    `INSERT INTO app_users (container_id, email, name, password_hash, role, invited_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.container_id, data.email, data.name, data.password_hash, data.role ?? 'editor', data.invited_by ?? null],
  )
  return result.rows[0]
}

export async function update(id: string, data: { role?: string; is_active?: boolean }): Promise<AppUser | null> {
  const sets: string[] = []
  const vals: any[] = []
  let idx = 1

  if (data.role !== undefined) { sets.push(`role = $${idx++}`); vals.push(data.role) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(data.is_active) }
  if (sets.length === 0) return findById(id)

  sets.push(`updated_at = NOW()`)
  vals.push(id)

  const result = await query<AppUser>(
    `UPDATE app_users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals,
  )
  return result.rows[0] ?? null
}

export async function remove(id: string): Promise<boolean> {
  const result = await query('DELETE FROM app_users WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}
