import type { APIRoute } from 'astro'
import { authenticate } from '../../../../../../server/middleware/auth'
import * as auditRepo from '../../../../../../server/modules/audit/repository'

export const GET: APIRoute = async ({ params, request, url }) => {
  try {
    authenticate(request)
    const limit = parseInt(url.searchParams.get('limit') ?? '50')
    const offset = parseInt(url.searchParams.get('offset') ?? '0')
    const result = await auditRepo.findByEntityId(params.id!, { limit, offset })
    return Response.json(result)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
