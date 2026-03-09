import { z } from 'zod'
import { ComponentSchema } from '../catalog/schemas'

export type UIComponent = z.infer<typeof ComponentSchema>
