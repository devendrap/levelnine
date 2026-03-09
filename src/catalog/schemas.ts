import { z } from 'zod'

const UINode: z.ZodType<any> = z.lazy(() => ComponentSchema)

const HeadingSchema = z.object({
  type: z.literal('Heading'),
  props: z.object({
    level: z.number().min(1).max(6).describe('Heading level 1-6'),
    content: z.string().describe('Heading text'),
  }),
}).describe('Section heading (h1-h6)')

const TextSchema = z.object({
  type: z.literal('Text'),
  props: z.object({
    content: z.string().describe('Text content'),
    variant: z.enum(['body', 'caption', 'code']).default('body').describe('Text style variant'),
  }),
}).describe('Text block')

const ButtonSchema = z.object({
  type: z.literal('Button'),
  props: z.object({
    label: z.string().describe('Button text'),
    variant: z.enum(['default', 'outline', 'ghost']).default('default').describe('Button style variant'),
    size: z.enum(['sm', 'md', 'lg']).default('md').describe('Button size'),
    action: z.string().optional().describe('Action to trigger on click (e.g. toggleTheme)'),
  }),
}).describe('Clickable button')

const InputSchema = z.object({
  type: z.literal('Input'),
  props: z.object({
    label: z.string().optional().describe('Input label'),
    placeholder: z.string().optional().describe('Placeholder text'),
    type: z.enum(['text', 'email', 'password', 'number', 'url']).default('text').describe('Input type'),
    required: z.boolean().default(false).describe('Whether input is required'),
    bind: z.string().optional().describe('State key to bind input value to (e.g. "username")'),
  }),
}).describe('Text input field')

const BadgeSchema = z.object({
  type: z.literal('Badge'),
  props: z.object({
    label: z.string().describe('Badge text'),
    variant: z.enum(['default', 'success', 'warning', 'error']).default('default').describe('Badge color variant'),
  }),
}).describe('Small status label')

const ListSchema = z.object({
  type: z.literal('List'),
  props: z.object({
    items: z.array(z.string()).describe('List items'),
    ordered: z.boolean().default(false).describe('Numbered list if true'),
  }),
}).describe('Ordered or unordered list')

const SeparatorSchema = z.object({
  type: z.literal('Separator'),
  props: z.object({
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal').describe('Separator direction'),
  }),
}).describe('Visual divider')

const StackSchema = z.object({
  type: z.literal('Stack'),
  props: z.object({
    gap: z.string().default('4').describe('Spacing between children (Tailwind scale)'),
  }),
  children: z.array(UINode).optional(),
}).describe('Vertical flex container')

const RowSchema = z.object({
  type: z.literal('Row'),
  props: z.object({
    gap: z.string().default('4').describe('Spacing between children (Tailwind scale)'),
    align: z.enum(['start', 'center', 'end', 'stretch']).default('start').describe('Cross-axis alignment'),
    justify: z.enum(['start', 'center', 'end', 'between']).default('start').describe('Main-axis justification'),
  }),
  children: z.array(UINode).optional(),
}).describe('Horizontal flex container')

const CardSchema = z.object({
  type: z.literal('Card'),
  props: z.object({
    title: z.string().optional().describe('Card title'),
    description: z.string().optional().describe('Card description text'),
  }),
  children: z.array(UINode).optional(),
}).describe('Bordered content container')

const TableSchema = z.object({
  type: z.literal('Table'),
  props: z.object({
    columns: z.array(z.string()).describe('Column headers'),
    rows: z.array(z.array(z.string())).describe('Table rows (array of string arrays)'),
  }),
}).describe('Data table with headers and rows')

const TabsSchema = z.object({
  type: z.literal('Tabs'),
  props: z.object({
    tabs: z.array(z.object({ label: z.string(), value: z.string() })).describe('Tab definitions'),
  }),
  children: z.array(UINode).optional(),
}).describe('Tabbed container – each child maps to a tab panel')

const ProgressSchema = z.object({
  type: z.literal('Progress'),
  props: z.object({
    value: z.number().min(0).max(100).describe('Progress percentage 0-100'),
    label: z.string().optional().describe('Label shown above the bar'),
  }),
}).describe('Progress bar indicator')

const AvatarSchema = z.object({
  type: z.literal('Avatar'),
  props: z.object({
    name: z.string().describe('Full name (initials are derived)'),
    size: z.enum(['sm', 'md', 'lg']).default('md').describe('Avatar size'),
  }),
}).describe('Circular avatar showing initials')

const DialogSchema = z.object({
  type: z.literal('Dialog'),
  props: z.object({
    title: z.string().describe('Dialog title'),
    open: z.boolean().default(true).describe('Whether dialog is visible'),
  }),
  children: z.array(UINode).optional(),
}).describe('Modal dialog overlay')

export const ComponentSchema = z.discriminatedUnion('type', [
  HeadingSchema, TextSchema, ButtonSchema, InputSchema,
  BadgeSchema, ListSchema, SeparatorSchema,
  StackSchema, RowSchema, CardSchema,
  TableSchema, TabsSchema, ProgressSchema, AvatarSchema, DialogSchema,
])

export { UINode }
