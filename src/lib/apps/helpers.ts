import { authenticateAppUser, type AppAuthPayload } from '../../../server/middleware/auth'
import * as containerService from '../../../server/modules/containers/service'
import * as entityService from '../../../server/modules/entities/service'
import { query } from '../../../server/db/index'
import type { Container, EntityType } from '../../../server/core/types/index'

export interface ContainerPage {
  id: string
  container_id: string
  name: string
  label: string
  route: string
  icon: string | null
  layout: 'single' | 'two_column' | 'grid'
  sections: any[]
  is_default: boolean
  access_roles: string[] | null
  sort_order: number
  source_dimension: string | null
  created_at: string
}

export interface UIConfig {
  id: string
  container_id: string
  name: string
  label: string
  entity_type: string
  view_type: 'master_detail' | 'full_page' | 'dashboard' | 'grid_only'
  grid_config: {
    columns: Array<{ field: string; label: string; width?: string; sortable?: boolean; filterable?: boolean }>
    default_sort?: { field: string; direction: 'asc' | 'desc' }
    row_actions?: string[]
    bulk_actions?: string[]
  } | null
  detail_config: {
    layout: 'tabs' | 'accordion' | 'sections'
    sections: Array<{ label: string; fields?: string[]; related_entity_type?: string }>
  } | null
  navigation: { menu_group: string; icon?: string; sort_order: number } | null
}

export interface AppContext {
  container: Container
  entityTypes: EntityType[]
  user: AppAuthPayload
}

/** Fetch D10 UI config for a specific entity type in a container */
export async function getUIConfig(containerId: string, entityType: string): Promise<UIConfig | null> {
  const result = await query<UIConfig>(
    'SELECT * FROM cfg_ui_configs WHERE container_id = $1 AND entity_type = $2 AND is_active = true LIMIT 1',
    [containerId, entityType],
  )
  return result.rows[0] ?? null
}

/** Fetch all UI configs for a container (for navigation ordering) */
export async function getAllUIConfigs(containerId: string): Promise<UIConfig[]> {
  const result = await query<UIConfig>(
    'SELECT * FROM cfg_ui_configs WHERE container_id = $1 AND is_active = true ORDER BY name',
    [containerId],
  )
  return result.rows
}

/** Fetch all custom pages for a container */
export async function getPages(containerId: string): Promise<ContainerPage[]> {
  const result = await query<ContainerPage>(
    'SELECT * FROM cfg_pages WHERE container_id = $1 ORDER BY sort_order, name',
    [containerId],
  )
  return result.rows
}

/** Fetch the default page (is_default = true) for a container */
export async function getDefaultPage(containerId: string): Promise<ContainerPage | null> {
  const result = await query<ContainerPage>(
    'SELECT * FROM cfg_pages WHERE container_id = $1 AND is_default = true LIMIT 1',
    [containerId],
  )
  return result.rows[0] ?? null
}

/** Fetch a page by route for a container */
export async function getPageByRoute(containerId: string, route: string): Promise<ContainerPage | null> {
  const result = await query<ContainerPage>(
    'SELECT * FROM cfg_pages WHERE container_id = $1 AND route = $2 LIMIT 1',
    [containerId, route],
  )
  return result.rows[0] ?? null
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
