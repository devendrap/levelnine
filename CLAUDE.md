# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun run dev` — Start Vite dev server on localhost:5173 (includes HTTP API middleware)
- `bun run build` — TypeScript check + Vite production build
- `bun run mcp` — Start the MCP server over stdio (`bun run src/mcp/server.ts`)
- `bun run preview` — Serve the production build locally

No test runner is configured.

## Architecture

### Data Flow: Catalog → Renderer → Preview

1. **Catalog** (`src/catalog/schemas.ts`): Zod v4 schemas define every UI component as a discriminated union (`ComponentSchema`). Each schema has `type` (literal), `props` (object), and optional `children` (recursive `UINode`). `src/catalog/prompt.ts` auto-generates an LLM prompt from these schemas.

2. **Renderer** (`src/renderer/Renderer.tsx`): A recursive Solid.js component that maps `{ type, props, children }` JSON nodes to actual components via a `componentMap` lookup. Uses `<Show>`, `<For>`, and `<ErrorBoundary>` for rendering.

3. **Preview** (`src/preview/App.tsx`): Split-pane editor — left side is a JSON textarea, right side live-renders via `Renderer`. JSON is validated against `ComponentSchema` on every keystroke. Routes like `/preview/:id` load stored specs via the API.

### MCP Server (`src/mcp/server.ts`)

Stdio-based MCP server exposing:
- **Resources**: `ui://catalog` (component docs), `ui://preview/{id}` (stored specs)
- **Tools**: `get_catalog`, `render_preview` (validate + save + return URL), `validate_ui_spec`, `list_previews`

Specs are persisted to `.previews/specs.json` via `src/mcp/previews.ts`.

### HTTP API (Vite middleware in `vite.config.ts`)

- `POST /api/generate` — Send `{ prompt, provider, model? }`, returns `{ spec, previewUrl }`
- `GET /api/preview/:id` — Fetch a stored spec by ID

The generate endpoint (`src/api/generate.ts`) calls an LLM via the OpenAI SDK, validates the response against `ComponentSchema`, and retries up to 3 times on validation failure.

### State Management (`src/stores/ui.ts`)

Uses nanostores. `$theme` (light/dark atom), `$formData` (map for input bindings), `builtinActions` (e.g., `toggleTheme`). Components call `runAction(name)` for actions.

## Adding a New Component

1. **Schema**: Add a new Zod object schema in `src/catalog/schemas.ts` with a literal `type`, `props` object, and optional `children: z.array(UINode)`. Add it to the `ComponentSchema` discriminated union array.

2. **Component**: Create `src/components/MyComponent.tsx`. Accept props as a function argument (not destructured in the signature for Solid reactivity). Use CSS variables (`var(--ui-text)`, etc.) for theming. Use `class` not `className`.

3. **Register**: Import and add the component to `componentMap` in `src/renderer/Renderer.tsx`.

The prompt generator (`src/catalog/prompt.ts`) reads schemas automatically, so LLMs will immediately know about the new component.

## Key Conventions

### Solid.js Patterns
- Use `class` attribute, not `className`
- Use `<Show when={...}>`, `<For each={...}>`, `<Dynamic>` — not ternaries or `.map()`
- Props are accessed as `props.foo` (not destructured) to preserve reactivity
- Signals: `createSignal` for local state, nanostores (`useStore`) for shared state

### Styling
- Tailwind CSS v4 (imported via `@import "tailwindcss"` in `src/index.css`)
- Themed components must use CSS custom properties defined in `src/index.css`: `--ui-bg`, `--ui-text`, `--ui-border`, `--ui-text-secondary`, `--ui-text-muted`, `--ui-bg-subtle`, `--ui-bg-muted`, `--ui-ring`
- Dark mode is applied via the `.dark` class on a parent element

### Zod v4
- Uses `zod` v4.3+ — import from `'zod'`, not `'zod/v4'`
- Schemas use `.describe()` for LLM-facing documentation
- `z.discriminatedUnion('type', [...])` is the top-level schema shape
- `safeParse` returns `{ success, data }` or `{ success, error }` with `.issues`

## Provider Configuration

The HTTP API (`src/api/providers.ts`) supports these providers via OpenAI-compatible clients:

| Provider | Env Var | Default Model | Base URL |
|----------|---------|---------------|----------|
| ollama | (none) | devstral-small-2:24b-cloud | localhost:11434/v1 |
| openai | `OPENAI_API_KEY` | gpt-4o | api.openai.com/v1 |
| xai | `XAI_API_KEY` | grok-3-mini | api.x.ai/v1 |
| gemini | `GEMINI_API_KEY` | gemini-2.5-flash | generativelanguage.googleapis.com/v1beta/openai |
| mistral | (none) | devstral-small-2:24b-cloud | localhost:11434/v1 |

Ollama and Mistral default to a local Ollama instance and require no API key.
