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
    tabs: z.array(z.object({ label: z.string(), value: z.string() })).describe('Tab definitions — array of {label: string, value: string}'),
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

const CheckboxSchema = z.object({
  type: z.literal('Checkbox'),
  props: z.object({
    label: z.string().describe('Checkbox label text'),
    bind: z.string().optional().describe('State key to bind checked state to (stores "true"/"false")'),
    defaultChecked: z.boolean().default(false).describe('Initial checked state'),
  }),
}).describe('Checkbox toggle for boolean values')

const SelectSchema = z.object({
  type: z.literal('Select'),
  props: z.object({
    label: z.string().optional().describe('Select label'),
    options: z.array(z.string()).describe('List of selectable options'),
    placeholder: z.string().optional().describe('Placeholder text when no option selected'),
    bind: z.string().optional().describe('State key to bind selected value to'),
  }),
}).describe('Dropdown select from a list of options')

const TextareaSchema = z.object({
  type: z.literal('Textarea'),
  props: z.object({
    label: z.string().optional().describe('Textarea label'),
    placeholder: z.string().optional().describe('Placeholder text'),
    rows: z.number().min(1).max(20).default(3).describe('Number of visible text rows'),
    required: z.boolean().default(false).describe('Whether textarea is required'),
    bind: z.string().optional().describe('State key to bind textarea value to'),
  }),
}).describe('Multi-line text input')

const DatePickerSchema = z.object({
  type: z.literal('DatePicker'),
  props: z.object({
    label: z.string().optional().describe('Date picker label'),
    bind: z.string().optional().describe('State key to bind date value to (ISO format YYYY-MM-DD)'),
    required: z.boolean().default(false).describe('Whether date is required'),
    min: z.string().optional().describe('Minimum date (YYYY-MM-DD)'),
    max: z.string().optional().describe('Maximum date (YYYY-MM-DD)'),
  }),
}).describe('Date input picker')

const AlertSchema = z.object({
  type: z.literal('Alert'),
  props: z.object({
    title: z.string().optional().describe('Alert title'),
    message: z.string().describe('Alert message text'),
    variant: z.enum(['info', 'success', 'warning', 'error']).default('info').describe('Alert severity variant'),
  }),
  children: z.array(UINode).optional(),
}).describe('Contextual alert banner with icon')

const AccordionSchema = z.object({
  type: z.literal('Accordion'),
  props: z.object({
    items: z.array(z.object({ title: z.string(), content: z.string() })).describe('Accordion sections — array of {title: string, content: string}'),
    multiple: z.boolean().default(false).describe('Allow multiple sections open at once'),
  }),
}).describe('Collapsible content sections')

const SwitchSchema = z.object({
  type: z.literal('Switch'),
  props: z.object({
    label: z.string().describe('Switch label text'),
    bind: z.string().optional().describe('State key to bind toggle state to (stores "true"/"false")'),
    defaultChecked: z.boolean().default(false).describe('Initial toggle state'),
  }),
}).describe('Toggle switch for on/off values')

const TooltipSchema = z.object({
  type: z.literal('Tooltip'),
  props: z.object({
    label: z.string().describe('Trigger text shown inline'),
    content: z.string().describe('Tooltip text shown on hover'),
  }),
  children: z.array(UINode).optional(),
}).describe('Hover tooltip with informational text')

const RadioGroupSchema = z.object({
  type: z.literal('RadioGroup'),
  props: z.object({
    label: z.string().optional().describe('Group label'),
    options: z.array(z.string()).describe('Radio options to choose from'),
    bind: z.string().optional().describe('State key to bind selected value to'),
    direction: z.enum(['vertical', 'horizontal']).default('vertical').describe('Layout direction'),
  }),
}).describe('Single-select radio button group')

const SkeletonSchema = z.object({
  type: z.literal('Skeleton'),
  props: z.object({
    lines: z.number().min(1).max(10).default(3).describe('Number of skeleton lines (text variant)'),
    height: z.string().optional().describe('Height of each line or avatar size (e.g. "40px")'),
    variant: z.enum(['text', 'card', 'avatar']).default('text').describe('Skeleton shape variant'),
  }),
}).describe('Loading placeholder skeleton')

const PaginationSchema = z.object({
  type: z.literal('Pagination'),
  props: z.object({
    totalPages: z.number().min(1).describe('Total number of pages'),
    bind: z.string().optional().describe('State key to bind current page number to'),
  }),
}).describe('Page navigation control')

const LinkSchema = z.object({
  type: z.literal('Link'),
  props: z.object({
    label: z.string().describe('Link text'),
    href: z.string().describe('URL to navigate to'),
    external: z.boolean().default(false).describe('Open in new tab with external icon'),
  }),
}).describe('Styled hyperlink')

export const ComponentSchema = z.discriminatedUnion('type', [
  HeadingSchema, TextSchema, ButtonSchema, InputSchema,
  BadgeSchema, ListSchema, SeparatorSchema,
  StackSchema, RowSchema, CardSchema,
  TableSchema, TabsSchema, ProgressSchema, AvatarSchema, DialogSchema,
  CheckboxSchema, SelectSchema, TextareaSchema, DatePickerSchema, AlertSchema, AccordionSchema,
  SwitchSchema, TooltipSchema, RadioGroupSchema, SkeletonSchema, PaginationSchema, LinkSchema,
])

export { UINode }
