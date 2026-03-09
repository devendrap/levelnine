# ai-ui

A Solid.js UI renderer driven by JSON specs and Zod schemas. Describe a UI as a JSON tree of typed components, and ai-ui validates and renders it live. An LLM can generate specs via the HTTP API or MCP server, producing instant previews in the browser.

## Quick Start

```bash
bun install
bun run dev        # http://localhost:5173
```

## Usage Modes

### 1. Split-Pane Preview (Browser)

Open `http://localhost:5173`. Edit JSON on the left, see the rendered UI on the right. The spec is validated against the component catalog on every keystroke.

### 2. MCP Server (Claude Desktop)

```bash
bun run mcp
```

Exposes tools over stdio for Claude Desktop or any MCP client:

- `get_catalog` — list available components and their props
- `render_preview` — validate a spec and get a preview URL
- `validate_ui_spec` — check a spec without saving
- `list_previews` — list stored preview IDs

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "ai-ui": {
      "command": "/path/to/.bun/bin/bun",
      "args": ["/path/to/ai-ui/src/mcp/server.ts"]
    }
  }
}
```

### 3. HTTP API

The dev server exposes an API for LLM-powered UI generation:

```bash
curl -X POST http://localhost:5173/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A signup form with name and email fields", "provider": "openai"}'
```

Returns:

```json
{
  "spec": { "type": "Stack", "props": { "gap": "4" }, "children": [...] },
  "previewUrl": "http://localhost:5173/preview/a1b2c3d4"
}
```

Fetch a stored spec: `GET /api/preview/:id`

## Providers

| Provider | Env Var | Default Model |
|----------|---------|---------------|
| ollama | — | devstral-small-2:24b-cloud |
| openai | `OPENAI_API_KEY` | gpt-4o |
| xai | `XAI_API_KEY` | grok-3-mini |
| gemini | `GEMINI_API_KEY` | gemini-2.5-flash |
| mistral | — | devstral-small-2:24b-cloud |

Copy `.env.example` to `.env` and fill in keys for cloud providers. Ollama and Mistral use a local Ollama instance.

## Available Components

**Layout**: Stack, Row, Card, Tabs, Dialog
**Content**: Heading, Text, Badge, List, Table, Progress, Avatar
**Input**: Button, Input, Separator

All components support light/dark theming via CSS custom properties.

## Adding a Component

1. Define a Zod schema in `src/catalog/schemas.ts` and add it to `ComponentSchema`
2. Create `src/components/YourComponent.tsx`
3. Register it in the `componentMap` in `src/renderer/Renderer.tsx`

The LLM prompt and MCP catalog update automatically from the schemas.

## Development Guide

See [CLAUDE.md](./CLAUDE.md) for architecture details, conventions, and full developer reference.
