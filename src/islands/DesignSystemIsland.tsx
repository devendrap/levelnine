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
import { Image } from '../components/Image'
import { Popover } from '../components/Popover'
import { ContextMenu } from '../components/ContextMenu'
import { Carousel } from '../components/Carousel'
import { DataGrid } from '../components/DataGrid'
import { MasterDetail } from '../components/MasterDetail'
import { FileUpload } from '../components/FileUpload'
import { For } from 'solid-js'
import type { JSX } from 'solid-js'

/* ── Helpers ── */
function Section(props: { title: string; subtitle?: string; children: JSX.Element }) {
  return (
    <section class="mb-16">
      <div class="mb-6">
        <h2
          class="text-2xl font-bold tracking-tight mb-1"
          style={{ color: 'var(--ui-text)' }}
        >
          {props.title}
        </h2>
        {props.subtitle && (
          <p class="text-sm" style={{ color: 'var(--ui-text-muted)' }}>{props.subtitle}</p>
        )}
      </div>
      <Separator />
      <div class="mt-6">{props.children}</div>
    </section>
  )
}

function Showcase(props: { label: string; children: JSX.Element }) {
  return (
    <div class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--ui-primary)' }}>
        {props.label}
      </p>
      <div
        class="rounded-xl border p-6"
        style={{
          'background-color': 'var(--ui-bg-subtle)',
          'border-color': 'var(--ui-border)',
        }}
      >
        {props.children}
      </div>
    </div>
  )
}

/* ── Main Component ── */
export default function DesignSystemIsland() {
  return (
    <div
      class="dark min-h-screen"
      style={{
        'background-color': 'var(--ui-bg)',
        'font-family': 'var(--ui-font)',
      }}
    >
      {/* Hero */}
      <div
        class="border-b px-12 py-16"
        style={{ 'border-color': 'var(--ui-border)' }}
      >
        <div class="max-w-6xl mx-auto">
          <div class="flex items-center gap-3 mb-4">
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
              style={{
                'background-color': 'var(--ui-primary)',
                color: 'var(--ui-text-on-primary)',
              }}
            >
              L9
            </div>
            <span class="text-sm font-medium" style={{ color: 'var(--ui-text-muted)' }}>
              DESIGN SYSTEM
            </span>
          </div>
          <h1
            class="text-5xl font-bold tracking-tight mb-3"
            style={{ color: 'var(--ui-text)' }}
          >
            LevelNine Components
          </h1>
          <p class="text-lg max-w-2xl" style={{ color: 'var(--ui-text-secondary)' }}>
            34 production components built with Solid.js + Tailwind CSS v4. ConstructNova theme — Gold primary, Blue accent, Navy dark surfaces.
          </p>
          <div class="flex gap-3 mt-6">
            <Badge label="v0.9.0" />
            <Badge label="34 Components" variant="success" />
            <Badge label="Dark Mode" variant="warning" />
          </div>
        </div>
      </div>

      {/* Token Swatches */}
      <div class="max-w-6xl mx-auto px-12 py-12">

        <Section title="Color Tokens" subtitle="CSS custom properties powering the entire theme">
          <Showcase label="Brand Colors">
            <div class="flex gap-4 flex-wrap">
              <For each={[
                { name: 'Primary (Gold)', var: '--ui-primary', hex: '#D4A44A' },
                { name: 'Primary Hover', var: '--ui-primary-hover', hex: '#e0b45a' },
                { name: 'Primary Light', var: '--ui-primary-light', hex: 'rgba(212,164,74,0.1)' },
                { name: 'Accent (Blue)', var: '--ui-accent', hex: '#3B8FE8' },
                { name: 'Accent Hover', var: '--ui-accent-hover', hex: '#5aa3f0' },
              ]}>
                {(c) => (
                  <div class="text-center">
                    <div
                      class="w-20 h-20 rounded-xl border mb-2"
                      style={{
                        'background-color': `var(${c.var})`,
                        'border-color': 'var(--ui-border)',
                      }}
                    />
                    <p class="text-xs font-medium" style={{ color: 'var(--ui-text)' }}>{c.name}</p>
                    <p class="text-xs" style={{ color: 'var(--ui-text-muted)', 'font-family': 'var(--ui-font-mono)' }}>{c.hex}</p>
                  </div>
                )}
              </For>
            </div>
          </Showcase>

          <Showcase label="Surface Colors">
            <div class="flex gap-4 flex-wrap">
              <For each={[
                { name: 'Background', var: '--ui-bg' },
                { name: 'Subtle', var: '--ui-bg-subtle' },
                { name: 'Muted', var: '--ui-bg-muted' },
                { name: 'Card', var: '--ui-card-bg' },
              ]}>
                {(c) => (
                  <div class="text-center">
                    <div
                      class="w-20 h-20 rounded-xl border mb-2"
                      style={{
                        'background-color': `var(${c.var})`,
                        'border-color': 'var(--ui-border)',
                      }}
                    />
                    <p class="text-xs font-medium" style={{ color: 'var(--ui-text)' }}>{c.name}</p>
                    <p class="text-xs" style={{ color: 'var(--ui-text-muted)', 'font-family': 'var(--ui-font-mono)' }}>{c.var}</p>
                  </div>
                )}
              </For>
            </div>
          </Showcase>

          <Showcase label="Semantic Colors">
            <div class="flex gap-4 flex-wrap">
              <For each={[
                { name: 'Success', var: '--ui-success' },
                { name: 'Warning', var: '--ui-warning' },
                { name: 'Error', var: '--ui-error' },
                { name: 'Info', var: '--ui-info' },
              ]}>
                {(c) => (
                  <div class="text-center">
                    <div
                      class="w-20 h-20 rounded-xl border mb-2"
                      style={{
                        'background-color': `var(${c.var})`,
                        'border-color': 'var(--ui-border)',
                      }}
                    />
                    <p class="text-xs font-medium" style={{ color: 'var(--ui-text)' }}>{c.name}</p>
                    <p class="text-xs" style={{ color: 'var(--ui-text-muted)', 'font-family': 'var(--ui-font-mono)' }}>{c.var}</p>
                  </div>
                )}
              </For>
            </div>
          </Showcase>

          <Showcase label="Text Colors">
            <div class="flex gap-6">
              <p class="text-base font-medium" style={{ color: 'var(--ui-text)' }}>Primary Text</p>
              <p class="text-base" style={{ color: 'var(--ui-text-secondary)' }}>Secondary Text</p>
              <p class="text-base" style={{ color: 'var(--ui-text-muted)' }}>Muted Text</p>
              <p class="text-base" style={{ color: 'var(--ui-text-placeholder)' }}>Placeholder Text</p>
            </div>
          </Showcase>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography" subtitle="DM Sans for body, Space Mono for code">
          <Showcase label="Headings">
            <Stack gap="4">
              <Heading level={1} content="Heading 1 — 32px Bold" />
              <Heading level={2} content="Heading 2 — 20px Bold" />
              <Heading level={3} content="Heading 3 — 18px Semibold" />
              <Heading level={4} content="Heading 4 — 16px Semibold" />
            </Stack>
          </Showcase>

          <Showcase label="Text Variants">
            <Stack gap="3">
              <Text content="Body text — the default variant for paragraph content." variant="body" />
              <Text content="Caption text — smaller, muted, for secondary information." variant="caption" />
              <Text content="const code = 'inline code variant'" variant="code" />
            </Stack>
          </Showcase>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Buttons" subtitle="Three variants, three sizes">
          <Showcase label="Variants">
            <Row gap="4" align="center">
              <Button label="Default (Gold)" variant="default" />
              <Button label="Outline" variant="outline" />
              <Button label="Ghost" variant="ghost" />
            </Row>
          </Showcase>

          <Showcase label="Sizes">
            <Row gap="4" align="center">
              <Button label="Small" size="sm" />
              <Button label="Medium" size="md" />
              <Button label="Large" size="lg" />
            </Row>
          </Showcase>
        </Section>

        {/* ── Badges ── */}
        <Section title="Badges" subtitle="Status indicators and labels">
          <Showcase label="Variants">
            <Row gap="3" align="center">
              <Badge label="Default" />
              <Badge label="Success" variant="success" />
              <Badge label="Warning" variant="warning" />
              <Badge label="Error" variant="error" />
            </Row>
          </Showcase>
        </Section>

        {/* ── Alerts ── */}
        <Section title="Alerts" subtitle="Contextual feedback messages">
          <Showcase label="All Variants">
            <Stack gap="4">
              <Alert title="Information" message="This is an informational alert with helpful context." variant="info" />
              <Alert title="Success" message="Operation completed successfully." variant="success" />
              <Alert title="Warning" message="Please review before proceeding." variant="warning" />
              <Alert title="Error" message="Something went wrong. Please try again." variant="error" />
            </Stack>
          </Showcase>
        </Section>

        {/* ── Form Controls ── */}
        <Section title="Form Controls" subtitle="Inputs, selects, checkboxes, and more">
          <Showcase label="Text Inputs">
            <div class="grid grid-cols-2 gap-6">
              <Input label="Full Name" placeholder="Enter your name" />
              <Input label="Email Address" placeholder="you@example.com" type="email" required />
            </div>
          </Showcase>

          <Showcase label="Textarea">
            <Textarea label="Description" placeholder="Write a detailed description..." rows={3} />
          </Showcase>

          <Showcase label="Select Dropdown">
            <div class="max-w-xs">
              <Select label="Department" options={['Engineering', 'Design', 'Marketing', 'Finance']} placeholder="Choose a department" />
            </div>
          </Showcase>

          <Showcase label="Checkbox & Switch">
            <Row gap="8" align="center">
              <Checkbox label="Accept terms and conditions" />
              <Switch label="Enable notifications" />
            </Row>
          </Showcase>

          <Showcase label="Radio Group">
            <Row gap="12">
              <RadioGroup label="Priority" options={['Low', 'Medium', 'High', 'Critical']} />
              <RadioGroup label="Layout" options={['Grid', 'List', 'Board']} direction="horizontal" />
            </Row>
          </Showcase>

          <Showcase label="Date Picker">
            <div class="max-w-xs">
              <DatePicker label="Start Date" />
            </div>
          </Showcase>

          <Showcase label="File Upload">
            <div class="max-w-md">
              <FileUpload label="Attachments" accept="image/*,.pdf" multiple />
            </div>
          </Showcase>
        </Section>

        {/* ── Cards ── */}
        <Section title="Cards" subtitle="Content containers with optional title and description">
          <Showcase label="Card Variants">
            <div class="grid grid-cols-3 gap-6">
              <Card title="Simple Card" description="A basic card with title and description." />
              <Card title="Card with Content">
                <Stack gap="3">
                  <Text content="Cards can contain any child components." variant="body" />
                  <Button label="Action" size="sm" />
                </Stack>
              </Card>
              <Card title="Metric Card">
                <div>
                  <p class="text-3xl font-bold" style={{ color: 'var(--ui-primary)' }}>2,847</p>
                  <Text content="Total audits completed this quarter" variant="caption" />
                </div>
              </Card>
            </div>
          </Showcase>
        </Section>

        {/* ── Table ── */}
        <Section title="Table" subtitle="Tabular data display with column flexibility">
          <Showcase label="Standard Table">
            <Table
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'role', header: 'Role' },
                { key: 'status', header: 'Status' },
                { key: 'date', header: 'Date' },
              ]}
              rows={[
                { name: 'Alice Chen', role: 'Lead Auditor', status: 'Active', date: '2026-03-10' },
                { name: 'Bob Martinez', role: 'Reviewer', status: 'Active', date: '2026-03-08' },
                { name: 'Carol Davis', role: 'Analyst', status: 'Pending', date: '2026-03-05' },
                { name: 'Dan Wilson', role: 'Compliance', status: 'Inactive', date: '2026-02-28' },
              ] as any}
            />
          </Showcase>
        </Section>

        {/* ── DataGrid ── */}
        <Section title="DataGrid" subtitle="Sortable, searchable, paginated data table">
          <Showcase label="Full-Featured Grid">
            <DataGrid
              columns={[
                { field: 'id', label: 'ID', width: '60px', sortable: true },
                { field: 'entity', label: 'Entity', sortable: true, filterable: true },
                { field: 'type', label: 'Type', sortable: true },
                { field: 'risk', label: 'Risk Level', sortable: true },
                { field: 'status', label: 'Status' },
              ]}
              data={[
                { id: '001', entity: 'Accounts Receivable', type: 'Financial', risk: 'High', status: 'In Review' },
                { id: '002', entity: 'Payroll Processing', type: 'Operational', risk: 'Medium', status: 'Approved' },
                { id: '003', entity: 'Tax Compliance', type: 'Regulatory', risk: 'Critical', status: 'Flagged' },
                { id: '004', entity: 'Vendor Payments', type: 'Financial', risk: 'Low', status: 'Completed' },
                { id: '005', entity: 'Inventory Valuation', type: 'Financial', risk: 'Medium', status: 'In Review' },
              ]}
              searchable
              pageSize={10}
            />
          </Showcase>
        </Section>

        {/* ── Tabs ── */}
        <Section title="Tabs" subtitle="Tabbed navigation panels">
          <Showcase label="Standard Tabs">
            <Tabs tabs={[{ label: 'Overview', value: 'overview' }, { label: 'Details', value: 'details' }, { label: 'History', value: 'history' }]}>
              <div>
                <Stack gap="3">
                  <Text content="Overview panel content with summary information." variant="body" />
                  <Progress value={72} label="Completion" />
                </Stack>
              </div>
              <div>
                <Text content="Detailed information and configuration options." variant="body" />
              </div>
              <div>
                <Text content="Historical activity log and audit trail." variant="body" />
              </div>
            </Tabs>
          </Showcase>
        </Section>

        {/* ── MasterDetail ── */}
        <Section title="MasterDetail" subtitle="Two-panel layout with master list and detail view">
          <Showcase label="Split Layout (40/60)">
            <div style={{ height: '260px' }}>
              <MasterDetail>
                <div>
                  <Stack gap="2">
                    <For each={['Accounts Receivable', 'Payroll Processing', 'Tax Compliance']}>
                      {(item) => (
                        <div
                          class="px-4 py-3 rounded-lg cursor-pointer text-sm"
                          style={{
                            color: 'var(--ui-text)',
                            'border': '1px solid var(--ui-border)',
                          }}
                        >
                          {item}
                        </div>
                      )}
                    </For>
                  </Stack>
                </div>
                <div class="p-4">
                  <Heading level={3} content="Select an item" />
                  <Text content="Choose from the master list to view details." variant="caption" />
                </div>
              </MasterDetail>
            </div>
          </Showcase>
        </Section>

        {/* ── Accordion ── */}
        <Section title="Accordion" subtitle="Expandable content sections">
          <Showcase label="Single Expand">
            <Accordion items={[
              { title: 'What is LevelNine?', content: 'LevelNine is an LLM-driven UI generation platform that creates production applications from JSON specifications.' },
              { title: 'How does the renderer work?', content: 'The recursive Renderer maps JSON nodes {type, props, children} to Solid.js components via a componentMap lookup.' },
              { title: 'What design system is used?', content: 'ConstructNova — featuring Gold (#D4A44A) primary, Blue (#3B8FE8) accent, and Navy (#0B0F1A) dark backgrounds.' },
            ]} />
          </Showcase>
        </Section>

        {/* ── Dialog ── */}
        <Section title="Dialog" subtitle="Modal overlay with trigger button">
          <Showcase label="Standard Dialog">
            <Dialog title="Confirm Action" trigger="Open Dialog">
              <Stack gap="4">
                <Text content="Are you sure you want to proceed with this action? This cannot be undone." variant="body" />
                <Row gap="3" justify="end">
                  <Button label="Cancel" variant="outline" size="sm" />
                  <Button label="Confirm" size="sm" />
                </Row>
              </Stack>
            </Dialog>
          </Showcase>
        </Section>

        {/* ── Popover ── */}
        <Section title="Popover" subtitle="Click-triggered floating panel">
          <Showcase label="Standard Popover">
            <Popover trigger="Show Details" title="Account Info" content="This account has been verified and is in good standing. Last reviewed on March 10, 2026." />
          </Showcase>
        </Section>

        {/* ── Tooltip ── */}
        <Section title="Tooltip" subtitle="Hover hint for additional context">
          <Showcase label="Standard Tooltip">
            <Row gap="6">
              <Tooltip label="Hover me" content="This is helpful tooltip text" />
              <Tooltip label="Another tooltip" content="More context information here" />
            </Row>
          </Showcase>
        </Section>

        {/* ── Context Menu ── */}
        <Section title="ContextMenu" subtitle="Right-click menu">
          <Showcase label="Right-click the box below">
            <ContextMenu items={[
              { label: 'Edit' },
              { label: 'Duplicate' },
              { label: 'Move to...' },
              { label: '---' },
              { label: 'Delete', variant: 'danger' },
            ]}>
              <div
                class="w-full h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-sm"
                style={{
                  'border-color': 'var(--ui-border)',
                  color: 'var(--ui-text-muted)',
                }}
              >
                Right-click this area
              </div>
            </ContextMenu>
          </Showcase>
        </Section>

        {/* ── Progress ── */}
        <Section title="Progress" subtitle="Visual progress indicator">
          <Showcase label="Various States">
            <Stack gap="5">
              <Progress value={25} label="Getting Started" />
              <Progress value={65} label="In Progress" />
              <Progress value={100} label="Complete" />
            </Stack>
          </Showcase>
        </Section>

        {/* ── Avatar ── */}
        <Section title="Avatar" subtitle="User initials with hash-based colors">
          <Showcase label="Sizes & Names">
            <Row gap="4" align="center">
              <Avatar name="Alice Chen" size="sm" />
              <Avatar name="Bob Martinez" size="md" />
              <Avatar name="Carol Davis" size="lg" />
              <Avatar name="Dan Wilson" size="md" />
              <Avatar name="Eve Foster" size="md" />
              <Avatar name="Frank Garcia" size="md" />
            </Row>
          </Showcase>
        </Section>

        {/* ── Skeleton ── */}
        <Section title="Skeleton" subtitle="Loading placeholder states">
          <Showcase label="Variants">
            <Row gap="8">
              <div>
                <Text content="Text Skeleton" variant="caption" />
                <div class="mt-2">
                  <Skeleton variant="text" lines={3} />
                </div>
              </div>
              <div>
                <Text content="Avatar Skeleton" variant="caption" />
                <div class="mt-2">
                  <Skeleton variant="avatar" />
                </div>
              </div>
              <div>
                <Text content="Card Skeleton" variant="caption" />
                <div class="mt-2">
                  <Skeleton variant="card" />
                </div>
              </div>
            </Row>
          </Showcase>
        </Section>

        {/* ── Charts ── */}
        <Section title="Charts" subtitle="Bar, line, doughnut, and pie charts via Chart.js">
          <Showcase label="Bar & Line Charts">
            <div class="grid grid-cols-2 gap-6">
              <Card title="Revenue by Quarter">
                <Chart
                  type="bar"
                  labels={['Q1', 'Q2', 'Q3', 'Q4']}
                  datasets={[
                    { label: 'Revenue', data: [42, 58, 71, 63], color: 'var(--ui-chart-1)' },
                    { label: 'Expenses', data: [28, 34, 39, 41], color: 'var(--ui-chart-2)' },
                  ]}
                  height="240px"
                />
              </Card>
              <Card title="Monthly Trend">
                <Chart
                  type="line"
                  labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']}
                  datasets={[
                    { label: 'Audits', data: [12, 19, 15, 25, 22, 30], color: 'var(--ui-chart-1)' },
                    { label: 'Findings', data: [5, 8, 6, 12, 9, 14], color: 'var(--ui-chart-3)' },
                  ]}
                  height="240px"
                />
              </Card>
            </div>
          </Showcase>

          <Showcase label="Doughnut & Pie Charts">
            <div class="grid grid-cols-2 gap-6">
              <Card title="Risk Distribution">
                <Chart
                  type="doughnut"
                  labels={['Low', 'Medium', 'High', 'Critical']}
                  datasets={[
                    { label: 'Risk', data: [40, 30, 20, 10], color: 'var(--ui-chart-3)' },
                  ]}
                  height="240px"
                />
              </Card>
              <Card title="Department Split">
                <Chart
                  type="pie"
                  labels={['Engineering', 'Design', 'Marketing', 'Sales']}
                  datasets={[
                    { label: 'Headcount', data: [45, 20, 15, 20], color: 'var(--ui-chart-1)' },
                  ]}
                  height="240px"
                />
              </Card>
            </div>
          </Showcase>
        </Section>

        {/* ── Pagination ── */}
        <Section title="Pagination" subtitle="Page navigation controls">
          <Showcase label="Standard Pagination">
            <Pagination totalPages={12} />
          </Showcase>
        </Section>

        {/* ── Lists ── */}
        <Section title="Lists" subtitle="Ordered and unordered lists">
          <Showcase label="Variants">
            <Row gap="12">
              <div>
                <Text content="Unordered" variant="caption" />
                <div class="mt-2">
                  <List items={['Revenue recognition', 'Expense classification', 'Asset valuation', 'Compliance checks']} />
                </div>
              </div>
              <div>
                <Text content="Ordered" variant="caption" />
                <div class="mt-2">
                  <List items={['Plan the audit scope', 'Gather evidence', 'Analyze findings', 'Write the report']} ordered />
                </div>
              </div>
            </Row>
          </Showcase>
        </Section>

        {/* ── Links ── */}
        <Section title="Links" subtitle="Navigation anchors">
          <Showcase label="Internal & External">
            <Row gap="6">
              <Link label="Internal Link" href="/dashboard" />
              <Link label="External Link" href="https://levelnine.ai" external />
            </Row>
          </Showcase>
        </Section>

        {/* ── Image ── */}
        <Section title="Image" subtitle="Responsive images with loading states">
          <Showcase label="With Caption">
            <div class="max-w-md">
              <Image
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=300&fit=crop"
                alt="Data dashboard"
                rounded="lg"
                caption="Sample dashboard visualization"
              />
            </div>
          </Showcase>
        </Section>

        {/* ── Carousel ── */}
        <Section title="Carousel" subtitle="Sliding content with autoplay">
          <Showcase label="Text Slides">
            <Carousel
              slides={[
                { content: 'LevelNine automates audit workflows with AI-driven insights.', caption: 'Intelligent Automation' },
                { content: 'Generate production-ready UIs from JSON specifications.', caption: 'Code Generation' },
                { content: 'Built on Solid.js for fine-grained reactivity and performance.', caption: 'Performance First' },
              ]}
              autoplay={false}
            />
          </Showcase>
        </Section>

        {/* ── Layout Components ── */}
        <Section title="Layout" subtitle="Stack, Row, and Separator">
          <Showcase label="Stack (Vertical)">
            <Stack gap="3">
              <div class="px-4 py-2 rounded-lg border text-sm" style={{ 'border-color': 'var(--ui-border)', color: 'var(--ui-text)' }}>Stack Item 1</div>
              <div class="px-4 py-2 rounded-lg border text-sm" style={{ 'border-color': 'var(--ui-border)', color: 'var(--ui-text)' }}>Stack Item 2</div>
              <div class="px-4 py-2 rounded-lg border text-sm" style={{ 'border-color': 'var(--ui-border)', color: 'var(--ui-text)' }}>Stack Item 3</div>
            </Stack>
          </Showcase>

          <Showcase label="Row (Horizontal) with Alignments">
            <Stack gap="4">
              <Row gap="3" align="center" justify="start">
                <Badge label="Start" />
                <Badge label="Aligned" variant="success" />
                <Badge label="Center" variant="warning" />
              </Row>
              <Row gap="3" align="center" justify="between">
                <Badge label="Left" />
                <Badge label="Center" variant="success" />
                <Badge label="Right" variant="warning" />
              </Row>
            </Stack>
          </Showcase>

          <Showcase label="Separator">
            <Stack gap="4">
              <Text content="Content above the separator" variant="body" />
              <Separator />
              <Text content="Content below the separator" variant="body" />
            </Stack>
          </Showcase>
        </Section>

        {/* ── Footer ── */}
        <div
          class="mt-16 border-t pt-8 pb-12 text-center"
          style={{ 'border-color': 'var(--ui-border)' }}
        >
          <Text content="LevelNine Design System — 34 Components" variant="caption" />
        </div>
      </div>
    </div>
  )
}
