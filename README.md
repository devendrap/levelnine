# LevelNine

An LLM-driven UI platform that transforms JSON specs into fully rendered interfaces. Define components via Zod schemas, generate UIs through AI conversation, and deploy industry-specific applications — all validated and type-safe.

Built with **Astro 5 SSR** + **Solid.js islands** + **Tailwind CSS v4** + **PostgreSQL**.

## Quick Start

```bash
bun install
bun run dev        # http://localhost:4321
```

Requires PostgreSQL (port 5433) and optionally MinIO for file uploads. Run `bun run server/db/migrate.ts` to apply migrations. See `.env.example` for configuration.

## Architecture

### How It Works

1. **Catalog** — Zod v4 schemas define 33 UI components as a discriminated union. Each schema has `type`, `props`, and optional `children`.
2. **Renderer** — A recursive Solid.js component maps `{ type, props, children }` JSON nodes to actual components via `componentMap`.
3. **Container Manager** — Chat with an LLM to design industry-specific applications. The AI generates JSON schemas for entity types (forms, tables, workflows) which are validated and rendered in real-time.
4. **Exploration Engine** — AI-driven multi-dimensional domain exploration. The AI systematically analyzes 8 dimensions (Structure, Roles, Workflows, Compliance, Documents, Integrations, Reporting, Edge Cases) with 4 steps each (Generate, Self-Review, Gap Analysis, Human Gate). Admin gates progress at each step.
5. **Entity System** — Generated schemas become entity types stored in PostgreSQL. Users create entities (records) against those types, rendered by the same JSON→component pipeline. Generic entity relations (many-to-many) replace rigid parent hierarchies.

### JSON-to-UI Approach

LevelNine uses the **declarative JSON spec** pattern — the same approach used by [Vercel json-render](https://json-render.dev/), [Google A2UI](https://a2ui.org/), and [Open-JSON-UI](https://github.com/nicholasgriffintn/open-json-ui). This sits between static component selection and open-ended code generation:

| Pattern | Security | Flexibility | Examples |
|---------|----------|-------------|----------|
| Static/Controlled | Highest | Lowest | CopilotKit |
| **Declarative JSON** | **High** | **Medium** | **LevelNine**, json-render, A2UI |
| Code Generation | Lowest | Highest | v0.dev |

Key advantages: schema-validated output, cross-platform potential, streamable rendering, and no sandbox required.

### Server Architecture

- **Astro 5 SSR** with `@astrojs/node` adapter — server-rendered pages with minimal client JS
- **Solid.js islands** via `client:only="solid-js"` — only interactive parts ship JavaScript
- **URL-driven routing** — container selection via `/containers/[id]`, tab switching via `?tab=` query params
- **Server-side data fetching** — Astro frontmatter calls services directly, no client-side fetch for initial data

### File Structure

```
src/
├── pages/                 ← Astro routes (SSR)
│   ├── index.astro        ← Editor (split-pane JSON ↔ preview)
│   ├── login.astro        ← Authentication
│   ├── dashboard.astro    ← Entity dashboard
│   ├── containers/        ← Container manager
│   │   ├── index.astro    ← Container list + empty state
│   │   └── [id].astro     ← Chat + explore + manifest tabs
│   ├── preview/[id].astro ← Rendered preview by ID
│   └── api/               ← API endpoints
│       └── v1/            ← Versioned REST API
├── components/            ← 33 Solid.js UI components
│   └── containers/        ← Container manager components
│       ├── Sidebar.astro          ← Server-rendered sidebar
│       ├── ContainerHeader.astro  ← Server-rendered header
│       ├── ManifestTab.astro      ← Server-rendered entity cards
│       ├── ChatPanel.tsx          ← Solid island: chat UI
│       ├── ExplorationPanel.tsx   ← Solid island: exploration UI
│       ├── GateDecisionCard.tsx   ← Solid island: gate decision buttons
│       ├── DimensionProgress.tsx  ← Solid: dimension progress pills
│       ├── ManifestActions.tsx    ← Solid island: action buttons
│       ├── EntityTypeActions.tsx  ← Solid island: per-entity actions
│       └── SidebarCreateForm.tsx  ← Solid island: create form
├── lib/containers/        ← Shared logic (parser, markdown, types, styles)
├── renderer/              ← Recursive JSON → component mapper
├── catalog/               ← Zod schemas + LLM prompt generator
├── stores/                ← Nanostores ($theme, $formData)
├── mcp/                   ← MCP stdio server
└── index.css              ← Design tokens (--ui-* CSS variables)
server/
├── db/                    ← PostgreSQL pool + migrations (5 migrations)
├── modules/
│   ├── containers/        ← Container CRUD, chat, lock/launch
│   ├── entities/          ← Entity CRUD
│   ├── relations/         ← Generic entity relations (many-to-many)
│   ├── exploration/       ← Exploration engine, prompts, dimension configs
│   └── auth/              ← JWT auth, registration
└── middleware/             ← Auth guards
```

## Usage Modes

### 1. Container Manager

Navigate to `/containers` to create industry-specific applications through AI-guided conversation. The LLM generates entity type schemas (forms, tables, workflows) that render as live previews in the chat. Review, refine, and lock containers for deployment.

### 2. Exploration Loop

From any container, click the **Explore** tab to start an AI-driven domain exploration. The AI systematically explores 8 dimensions:

| Dimension | Focus |
|-----------|-------|
| Structure | Core entity types, data models, hierarchy |
| Roles & Access | User roles, permissions, authorization |
| Workflows | Business processes, state machines, approvals |
| Compliance | Regulatory requirements, standards, audit trails |
| Documents | Document types, templates, versioning, retention |
| Integrations | External systems, APIs, data sync |
| Reporting | Dashboards, KPIs, analytics, scheduled reports |
| Edge Cases | Exception handling, error recovery, boundaries |

Each dimension runs 4 steps: **Generate** → **Self-Review** → **Gap Analysis** → **Human Gate**. At each gate, the admin chooses: Continue, Go Deeper, Skip, or Stop. Entity types, relations, and scope items are merged into the container manifest as the exploration progresses. Manifest snapshots are captured after each gate decision.

### 3. Split-Pane Editor

Open `/` to edit JSON specs directly. Left pane: JSON editor. Right pane: live rendered preview. Validated against the component catalog on every keystroke.

### 4. MCP Server (Claude Desktop)

```bash
bun run mcp
```

Exposes tools over stdio:
- `get_catalog` — list available components and their props
- `render_preview` — validate a spec and get a preview URL
- `validate_ui_spec` — check a spec without saving
- `list_previews` — list stored preview IDs
- `link_entities` / `unlink_entities` / `get_entity_relations` — manage entity relations
- Container + entity CRUD tools

### 5. HTTP API

```bash
# Generate UI from natural language
curl -X POST http://localhost:4321/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A signup form with name and email fields", "provider": "openai"}'

# Container chat
curl -X POST http://localhost:4321/api/v1/containers/:id/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Build a trucking management app", "provider": "ollama"}'

# Start exploration
curl -X POST http://localhost:4321/api/v1/containers/:id/exploration/start

# Run next exploration step (SSE stream)
curl -X POST http://localhost:4321/api/v1/containers/:id/exploration/next \
  -H "Content-Type: application/json" \
  -d '{"run_id": "...", "provider": "ollama"}'

# Submit gate decision
curl -X POST http://localhost:4321/api/v1/containers/:id/exploration/gate/:stepId \
  -H "Content-Type: application/json" \
  -d '{"decision": "continue"}'

# Entity relations
curl -X POST http://localhost:4321/api/v1/relations \
  -H "Content-Type: application/json" \
  -d '{"source_entity_id": "...", "target_entity_id": "...", "relation_type": "belongs_to"}'
```

## Components (33)

**Layout**: Stack, Row, Card, Tabs, Dialog, Spacer, Grid, Container
**Content**: Heading, Text, Badge, List, Table, Progress, Avatar, Image, Skeleton
**Input**: Button, Input, Select, Checkbox, RadioGroup, Switch, DatePicker, FileUpload, Textarea (RichText), Pagination
**Feedback**: Tooltip, Popover, ContextMenu, Link, Separator
**Data**: Chart (bar/line/doughnut/pie), Carousel

All components use `--ui-*` CSS custom properties for theming. Dark mode via `.dark` class.

## Providers

| Provider | Env Var | Default Model |
|----------|---------|---------------|
| ollama | — | devstral-small-2:24b-cloud |
| openai | `OPENAI_API_KEY` | gpt-4o |
| xai | `XAI_API_KEY` | grok-3-mini |
| gemini | `GEMINI_API_KEY` | gemini-2.5-flash |
| mistral | — | devstral-small-2:24b-cloud |

## Adding a Component

1. Define a Zod schema in `src/catalog/schemas.ts` and add to `ComponentSchema`
2. Create `src/components/YourComponent.tsx` using CSS variables for theming
3. Register in `componentMap` in `src/renderer/Renderer.tsx`

The LLM prompt and MCP catalog update automatically from the schemas.

## Development

See [CLAUDE.md](./CLAUDE.md) for architecture details, conventions, and full developer reference.

```bash
bun run dev      # Dev server on :4321
bun run build    # Production build
bun run preview  # Serve production build
bun run mcp      # MCP server (stdio)
```
