import { query } from '../../db/index'
import type { User } from '../../core/types/index'

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>('SELECT * FROM users WHERE email = $1', [email])
  return result.rows[0] ?? null
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function insertUser(data: {
  email: string
  name: string
  password_hash: string
  role?: string
}): Promise<User> {
  const result = await query<User>(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.email, data.name, data.password_hash, data.role ?? 'staff'],
  )
  return result.rows[0]
}
