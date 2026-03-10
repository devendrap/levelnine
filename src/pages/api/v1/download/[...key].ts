import type { APIRoute } from 'astro'
import { getDownloadUrl } from '../../../../../server/modules/storage/s3'
import { authenticate } from '../../../../../server/middleware/auth'

// GET /api/v1/download/uploads/uuid.ext (catch-all for s3 key path)
export const GET: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const s3Key = params.key!
    const url = await getDownloadUrl(s3Key)
    return Response.redirect(url, 302)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
