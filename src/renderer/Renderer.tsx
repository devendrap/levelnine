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
import type { UIComponent } from './types'

const componentMap: Record<string, any> = {
  Heading, Text, Button, Input, Badge, List, Separator, Stack, Row, Card,
  Table, Tabs, Progress, Avatar, Dialog,
}

export function Renderer(props: { node: UIComponent }) {
  const Component = () => componentMap[props.node.type]

  return (
    <Show when={Component()} fallback={<span class="text-red-500 text-sm">Unknown: {props.node.type}</span>}>
      <ErrorBoundary fallback={(err: Error) => <div class="text-red-500 text-sm border border-red-300 p-2 rounded">Render error: {err.message}</div>}>
        {(() => {
          const C = Component()!
          return (
            <C {...props.node.props}>
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
