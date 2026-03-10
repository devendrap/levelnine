# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun run dev` — Start Astro dev server on localhost:4321
- `bun run build` — Astro production build (outputs to `dist/`)
- `bun run preview` — Serve the production build locally
- `bun run mcp` — Start the MCP server over stdio (`bun run src/mcp/server.ts`)

No test runner is configured.

## Architecture

### Server: Astro 5 + Solid.js + Tailwind CSS v4

- **Astro SSR** with `@astrojs/node` adapter (standalone mode) for production
- **Solid.js islands** via `client:only="solid-js"` — components hydrate client-side only
- **Tailwind v4** via `@tailwindcss/vite` plugin (not the deprecated `@astrojs/tailwind`)
- **Nanostores** for shared state (`@nanostores/solid`)

### File Structure

```
src/
├── pages/               ← Astro routes (SSR)
│   ├── index.astro      ← Editor (split-pane JSON ↔ preview)
│   ├── dashboard.astro  ← Entity dashboard (placeholder)
│   ├── preview/[id].astro ← Rendered preview by ID
│   └── api/
│       ├── generate.ts  ← POST: LLM → spec → save
│       └── preview/[id].ts ← GET: fetch stored spec
├── islands/             ← Solid.js island wrappers for Astro
├── components/          ← 33 Solid.js UI components
├── renderer/            ← Recursive JSON → component mapper
├── catalog/             ← Zod schemas + LLM prompt generator
├── stores/              ← Nanostores ($theme, $formData)
├── preview/             ← App.tsx (editor), PreviewRoute.tsx
├── api/                 ← LLM client (generate.ts, providers.ts)
├── mcp/                 ← MCP stdio server
└── index.css            ← Design tokens (--ui-* CSS variables)
server/                  ← Production backend (planned)
├── db/                  ← PostgreSQL pool + migrations
├── core/types/          ← TypeScript interfaces
├── modules/             ← entities, auth, generate
└── middleware/           ← Auth guards, error handling
```

### Data Flow: Catalog → Renderer → Preview

1. **Catalog** (`src/catalog/schemas.ts`): Zod v4 schemas define every UI component as a discriminated union (`ComponentSchema`). Each schema has `type` (literal), `props` (object), and optional `children` (recursive `UINode`). `src/catalog/prompt.ts` auto-generates an LLM prompt from these schemas.

2. **Renderer** (`src/renderer/Renderer.tsx`): A recursive Solid.js component that maps `{ type, props, children }` JSON nodes to actual components via a `componentMap` lookup. Uses `<Show>`, `<For>`, and `<ErrorBoundary>`.

3. **Preview** (`src/preview/App.tsx`): Split-pane editor — left JSON textarea, right live-renders via `Renderer`. JSON validated against `ComponentSchema` on every keystroke. `/preview/:id` loads stored specs via API.

### MCP Server (`src/mcp/server.ts`)

Stdio-based MCP server exposing:
- **Resources**: `ui://catalog`, `ui://preview/{id}`
- **Tools**: `get_catalog`, `render_preview`, `validate_ui_spec`, `list_previews`

### State Management (`src/stores/ui.ts`)

Nanostores: `$theme` (light/dark atom), `$formData` (map for input bindings), `builtinActions` (e.g., `toggleTheme`).

## Adding a New Component

1. **Schema**: Add Zod schema in `src/catalog/schemas.ts` with literal `type`, `props`, optional `children: z.array(UINode)`. Add to `ComponentSchema` discriminated union.
2. **Component**: Create `src/components/MyComponent.tsx`. Use CSS variables for theming. Use `class` not `className`.
3. **Register**: Import and add to `componentMap` in `src/renderer/Renderer.tsx`.

The prompt generator reads schemas automatically — LLMs immediately know about new components.

## Key Conventions

### Solid.js
- `class` not `className`
- `<Show>`, `<For>`, `<Dynamic>` — not ternaries or `.map()`
- Props accessed as `props.foo` (not destructured) for reactivity
- `createSignal` for local, `useStore()` for shared state

### Styling
- Tailwind CSS v4 (`@import "tailwindcss"` in `src/index.css`)
- All themed components use `--ui-*` CSS variables from `src/index.css`
- Dark mode via `.dark` class on parent element

### Zod v4
- Import from `'zod'` (not `'zod/v4'`)
- `.describe()` for LLM-facing docs
- `z.discriminatedUnion('type', [...])` for top-level schema

## Provider Configuration

The generate endpoint (`src/api/providers.ts`) supports OpenAI-compatible providers:

| Provider | Env Var | Default Model | Base URL |
|----------|---------|---------------|----------|
| ollama | (none) | devstral-small-2:24b-cloud | localhost:11434/v1 |
| openai | `OPENAI_API_KEY` | gpt-4o | api.openai.com/v1 |
| xai | `XAI_API_KEY` | grok-3-mini | api.x.ai/v1 |
| gemini | `GEMINI_API_KEY` | gemini-2.5-flash | generativelanguage.googleapis.com/v1beta/openai |
| mistral | (none) | devstral-small-2:24b-cloud | localhost:11434/v1 |
