import { Show, For, ErrorBoundary } from 'solid-js'
import { Heading } from '../components/Heading'
import { Text } from '../components/Text'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Badge } from '../components/Badge'
import { List } from '../components/List'
import { Separator } from '../components/Separator'
import { Stack } from '../components/Stack'
import { Row } from '../components/Row'
import { Card } from '../components/Card'
import { Table } from '../components/Table'
import { Tabs } from '../components/Tabs'
import { Progress } from '../components/Progress'
import { Avatar } from '../components/Avatar'
import { Dialog } from '../components/Dialog'
import { Checkbox } from '../components/Checkbox'
import { Select } from '../components/Select'
import { Textarea } from '../components/Textarea'
import { DatePicker } from '../components/DatePicker'
import { Alert } from '../components/Alert'
import { Accordion } from '../components/Accordion'
import { Switch } from '../components/Switch'
import { Tooltip } from '../components/Tooltip'
import { RadioGroup } from '../components/RadioGroup'
import { Skeleton } from '../components/Skeleton'
import { Pagination } from '../components/Pagination'
import { Link } from '../components/Link'
import { Chart } from '../components/Chart'
import { FileUpload } from '../components/FileUpload'
import { Image } from '../components/Image'
import { Popover } from '../components/Popover'
import { ContextMenu } from '../components/ContextMenu'
import { Carousel } from '../components/Carousel'
import { DataGrid } from '../components/DataGrid'
import { MasterDetail } from '../components/MasterDetail'
import type { UIComponent } from './types'

// Container alias — wraps children in a padded div (used by AI-generated schemas)
function ContainerWrapper(props: { padding?: string; children?: any }) {
  const pad = () => ({ sm: '8px', md: '16px', lg: '24px' }[props.padding ?? 'md'] ?? '16px')
  return <div style={{ padding: pad() }}>{props.children}</div>
}

// Grid alias — responsive grid layout
function GridLayout(props: { columns?: number; children?: any }) {
  return (
    <div style={{
      display: 'grid',
      'grid-template-columns': `repeat(${props.columns ?? 2}, 1fr)`,
      gap: '16px',
    }}>
      {props.children}
    </div>
  )
}

// Spacer alias
function SpacerBlock(props: { size?: string }) {
  const h = () => ({ sm: '8px', md: '16px', lg: '24px' }[props.size ?? 'md'] ?? '16px')
  return <div style={{ height: h() }} />
}

const componentMap: Record<string, any> = {
  Heading, Text, Button, Input, Badge, List, Separator, Stack, Row, Card,
  Table, Tabs, Progress, Avatar, Dialog,
  Checkbox, Select, Textarea, DatePicker, Alert, Accordion,
  Switch, Tooltip, RadioGroup, Skeleton, Pagination, Link,
  Chart, FileUpload, Image, Popover, ContextMenu, Carousel,
  DataGrid, MasterDetail,
  // Aliases for AI-generated schemas
  Container: ContainerWrapper,
  Grid: GridLayout,
  Spacer: SpacerBlock,
  Divider: Separator,
  Toggle: Switch,
  RichText: Textarea,
  TextArea: Textarea,
  NumberInput: Input,
  ProgressBar: Progress,
}

// Form component types that accept disabled prop
const formComponents = new Set([
  'Input', 'Select', 'Checkbox', 'DatePicker', 'Textarea', 'RichText',
  'TextArea', 'NumberInput', 'Switch', 'Toggle', 'RadioGroup', 'FileUpload',
])

export function Renderer(props: { node: UIComponent; readOnly?: boolean }) {
  const Component = () => componentMap[props.node.type]

  return (
    <Show when={Component()} fallback={<span class="text-red-500 text-sm">Unknown: {props.node.type}</span>}>
      <ErrorBoundary fallback={(err: Error) => <div class="text-red-500 text-sm border border-red-300 p-2 rounded">Render error: {err.message}</div>}>
        {(() => {
          const C = Component()!
          const nodeProps = { ...props.node.props } as Record<string, any>

          // Thread readOnly as disabled to form components
          if (props.readOnly && formComponents.has(props.node.type)) {
            nodeProps.disabled = true
          }

          // MasterDetail: render exactly 2 children into left/right slots
          if (props.node.type === 'MasterDetail' && (props.node as any).children) {
            const kids = (props.node as any).children as UIComponent[]
            return (
              <C {...nodeProps}>
                <For each={kids}>
                  {(child: UIComponent) => <Renderer node={child} readOnly={props.readOnly} />}
                </For>
              </C>
            )
          }

          // Tabs: handle both LLM formats
          // Format A (object): props.tabs = [{label, children}]  — children embedded in tab objects
          // Format B (string): props.tabs = ["Tab1", "Tab2"]     — children are sibling nodes
          if (props.node.type === 'Tabs' && nodeProps.tabs) {
            const raw = nodeProps.tabs as (string | { label: string; value?: string; children?: UIComponent[] })[]
            const siblingChildren = ((props.node as any).children ?? []) as UIComponent[]
            const isStringFormat = typeof raw[0] === 'string'

            const normalized = raw.map((t, i) => {
              if (typeof t === 'string') {
                return { label: t, value: t, children: siblingChildren[i] ? [siblingChildren[i]] : [] as UIComponent[] }
              }
              return { label: t.label, value: t.value ?? t.label, children: t.children ?? [] as UIComponent[] }
            })

            return (
              <C tabs={normalized.map(t => ({ label: t.label, value: t.value }))}>
                <For each={normalized}>
                  {(tab) => (
                    <div>
                      <For each={tab.children}>
                        {(child: UIComponent) => <Renderer node={child} readOnly={props.readOnly} />}
                      </For>
                    </div>
                  )}
                </For>
              </C>
            )
          }

          return (
            <C {...nodeProps}>
              <Show when={'children' in props.node && (props.node as any).children}>
                <For each={(props.node as any).children}>
                  {(child: UIComponent) => <Renderer node={child} readOnly={props.readOnly} />}
                </For>
              </Show>
            </C>
          )
        })()}
      </ErrorBoundary>
    </Show>
  )
}
