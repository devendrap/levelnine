import { query } from '../../db/index'
import type { Container, ContainerMessage } from '../../core/types/index'

export async function findAllContainers(): Promise<Container[]> {
  const result = await query<Container>('SELECT * FROM containers ORDER BY updated_at DESC')
  return result.rows
}

export async function findContainerById(id: string): Promise<Container | null> {
  const result = await query<Container>('SELECT * FROM containers WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function insertContainer(data: {
  name: string
  description?: string
  created_by_user_id?: string
}): Promise<Container> {
  const result = await query<Container>(
    `INSERT INTO containers (name, description, created_by_user_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.description ?? null, data.created_by_user_id ?? null],
  )
  return result.rows[0]
}

export async function updateContainer(
  id: string,
  data: { name?: string; description?: string; status?: string; manifest?: Record<string, any> },
): Promise<Container | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description) }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status) }
  if (data.manifest !== undefined) { sets.push(`manifest = $${idx++}`); params.push(JSON.stringify(data.manifest)) }

  if (sets.length === 0) return findContainerById(id)

  params.push(id)
  const result = await query<Container>(
    `UPDATE containers SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  )
  return result.rows[0] ?? null
}

export async function deleteContainer(id: string): Promise<boolean> {
  const result = await query('DELETE FROM containers WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}

// Messages
export async function findMessagesByContainer(containerId: string): Promise<ContainerMessage[]> {
  const result = await query<ContainerMessage>(
    'SELECT * FROM container_messages WHERE container_id = $1 ORDER BY created_at ASC',
    [containerId],
  )
  return result.rows
}

export async function insertMessage(data: {
  container_id: string
  role: string
  content: string
  metadata?: Record<string, any>
}): Promise<ContainerMessage> {
  const result = await query<ContainerMessage>(
    `INSERT INTO container_messages (container_id, role, content, metadata)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.container_id, data.role, data.content, JSON.stringify(data.metadata ?? {})],
  )
  return result.rows[0]
}
