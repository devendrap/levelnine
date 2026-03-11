import { authenticateAppUser, type AppAuthPayload } from '../../../server/middleware/auth'
import * as containerService from '../../../server/modules/containers/service'
import * as entityService from '../../../server/modules/entities/service'
import type { Container, EntityType } from '../../../server/core/types/index'

export interface AppContext {
  container: Container
  entityTypes: EntityType[]
  user: AppAuthPayload
}

/**
 * Load app context from an Astro request.
 * Accepts both app_token (app users) and token (platform admins).
 * Redirects to app login on auth failure.
 */
export async function loadAppContext(Astro: any): Promise<AppContext | Response> {
  const slug = Astro.params.slug

  let container: Container
  try {
    container = await containerService.getContainerBySlug(slug)
  } catch {
    return Astro.redirect('/dashboard')
  }

  if (container.status !== 'launched') {
    return Astro.redirect(`/containers/${container.id}`)
  }

  let user: AppAuthPayload
  try {
    user = await authenticateAppUser(Astro.request, slug)
  } catch {
    return Astro.redirect(`/apps/${slug}/login`)
  }

  const entityTypes = await entityService.listEntityTypes(true, container.id)

  return { container, entityTypes, user }
}
