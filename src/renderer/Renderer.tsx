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
  // Aliases for AI-generated schemas
  Container: ContainerWrapper,
  Grid: GridLayout,
  Spacer: SpacerBlock,
  Divider: Separator,
  Toggle: Switch,
  RichText: Textarea,
  ProgressBar: Progress,
}

export function Renderer(props: { node: UIComponent }) {
  const Component = () => componentMap[props.node.type]

  return (
    <Show when={Component()} fallback={<span class="text-red-500 text-sm">Unknown: {props.node.type}</span>}>
      <ErrorBoundary fallback={(err: Error) => <div class="text-red-500 text-sm border border-red-300 p-2 rounded">Render error: {err.message}</div>}>
        {(() => {
          const C = Component()!
          const nodeProps = props.node.props

          // Tabs: convert tabs[].children JSON nodes into JSX children panels
          if (props.node.type === 'Tabs' && (nodeProps as any).tabs) {
            const tabs = (nodeProps as any).tabs as { label: string; value?: string; children?: UIComponent[] }[]
            return (
              <C tabs={tabs.map(t => ({ label: t.label, value: t.value }))}>
                <For each={tabs}>
                  {(tab) => (
                    <div>
                      <Show when={tab.children}>
                        <For each={tab.children!}>
                          {(child: UIComponent) => <Renderer node={child} />}
                        </For>
                      </Show>
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
                  {(child: UIComponent) => <Renderer node={child} />}
                </For>
              </Show>
            </C>
          )
        })()}
      </ErrorBoundary>
    </Show>
  )
}
