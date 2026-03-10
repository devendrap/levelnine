import type { APIRoute } from 'astro'
import { uploadFile } from '../../../../server/modules/storage/s3'
import { authenticate } from '../../../../server/middleware/auth'
import * as entityService from '../../../../server/modules/entities/service'

// POST /api/v1/upload
// Multipart form: file + optional entity_id to attach to
export const POST: APIRoute = async ({ request }) => {
  try {
    authenticate(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return Response.json({ error: 'File too large (max 50MB)' }, { status: 400 })
    }

    const buffer = new Uint8Array(await file.arrayBuffer())
    const { s3Key, originalFilename } = await uploadFile(
      buffer,
      file.name,
      file.type || 'application/octet-stream',
    )

    // If entity_id provided, attach file to entity
    const entityId = formData.get('entity_id') as string | null
    if (entityId) {
      await entityService.updateEntity(entityId, {
        s3_key: s3Key,
        original_filename: originalFilename,
      })
    }

    return Response.json({ s3Key, originalFilename, size: file.size }, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
