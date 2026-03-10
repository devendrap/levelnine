# ai-ui: From Prompt to Production App

A step-by-step guide to building, deploying, and managing data-driven applications using LLM-powered container design.

---

## Table of Contents

1. [Setup](#1-setup)
2. [Create Your First Admin Account](#2-create-your-first-admin-account)
3. [Design a Container via Chat](#3-design-a-container-via-chat)
4. [Iterate on Entity Types](#4-iterate-on-entity-types)
5. [Generate Schemas](#5-generate-schemas)
6. [Review and Lock](#6-review-and-lock)
7. [Launch the App](#7-launch-the-app)
8. [App User Registration and Login](#8-app-user-registration-and-login)
9. [Managing App Users and Roles](#9-managing-app-users-and-roles)
10. [Working with Entities](#10-working-with-entities)
11. [Platform Admin Access](#11-platform-admin-access)
12. [API Reference](#12-api-reference)
13. [Docker Production Deployment](#13-docker-production-deployment)

---

## 1. Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- PostgreSQL 17 (port 5433 by default)
- MinIO or S3-compatible storage (ports 9000/9001)
- An LLM provider (Ollama local, OpenAI, xAI, or Gemini)

### Quick Start with Docker Compose

```bash
# Start PostgreSQL + MinIO
docker-compose up -d postgres minio

# Install dependencies
bun install

# Copy and configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, LLM keys, etc.

# Run database migrations
bun run migrate

# Start development server
bun run dev
```

The app runs at **http://localhost:4321**.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | `localhost` | PostgreSQL host |
| `DB_PORT` | Yes | `5433` | PostgreSQL port |
| `DB_USER` | Yes | `aiui` | Database user |
| `DB_PASSWORD` | Yes | `aiui_dev` | Database password |
| `DB_NAME` | Yes | `aiui` | Database name |
| `JWT_SECRET` | Yes | dev default | Token signing key (change in prod!) |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiry |
| `S3_ENDPOINT` | Yes | `http://localhost:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | Yes | `aiui` | S3 access key |
| `S3_SECRET_KEY` | Yes | `aiui_dev_secret` | S3 secret key |
| `S3_BUCKET` | Yes | `ai-ui-uploads` | S3 bucket name |
| `OPENAI_API_KEY` | No | — | OpenAI provider |
| `XAI_API_KEY` | No | — | xAI/Grok provider |
| `GEMINI_API_KEY` | No | — | Google Gemini provider |

---

## 2. Create Your First Admin Account

Before you can do anything, register a platform admin:

**Via the UI:**
Navigate to `http://localhost:4321` — you'll be redirected to the login page. Click "Register" and create an account.

**Via the API:**
```bash
curl -X POST http://localhost:4321/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "name": "Admin",
    "password": "your_password_here",
    "role": "admin"
  }'
```

Platform roles (highest to lowest): **admin** > partner > manager > staff > viewer.

After login, you'll land on the **Dashboard** showing launched apps, entity counts, and recent activity.

---

## 3. Design a Container via Chat

A **container** is an industry-specific application definition. You build it by chatting with an LLM that understands your domain.

### Create a New Container

1. Navigate to **http://localhost:4321/containers**
2. Click **"+ New Container"** in the sidebar
3. Enter a name (e.g., "Restaurant Health Inspector") and submit

You're now in the **Chat tab** — a conversation interface with an LLM domain expert.

### Prompting Best Practices

Start with a clear description of your industry and use case:

> "I need an audit management system for restaurant health inspections. Inspectors visit restaurants, fill out inspection checklists, log violations, and generate compliance reports."

The LLM will respond with:
- A detailed conversation about the domain
- Proposed **entity types** (e.g., `restaurant`, `inspection`, `violation`, `inspector`)
- Each entity type includes: name, description, and key fields
- A machine-readable summary block at the end

### Save Entity Types to Manifest

After the LLM proposes entity types, click **"Save All to Manifest"** in the chat panel. This extracts the entity types from the LLM's response and saves them to the container's manifest.

You can continue chatting to refine, add more entity types, or adjust descriptions. Each "Save All" merges new types into the existing manifest (matched by name).

### Selecting an LLM Provider

Use the **provider dropdown** in the container header to switch between:
- **Ollama** (local, no API key needed)
- **OpenAI** (requires `OPENAI_API_KEY`)
- **xAI** (requires `XAI_API_KEY`)
- **Gemini** (requires `GEMINI_API_KEY`)

---

## 4. Iterate on Entity Types

Switch to the **Manifest tab** to see all saved entity types in a table view.

### The Manifest Table

Each entity type row shows:
- **Name** — snake_case identifier
- **Description** — what this entity represents
- **Schema** — status indicator (ready or missing)
- **Review** — pending or reviewed

### Enhance Individual Types

If an entity type needs a more detailed schema:

1. Click **"Enhance"** on the entity type row
2. You're taken back to the Chat tab with a pre-filled prompt asking the LLM to generate a full JSON schema for that specific type
3. The LLM responds with a detailed ai-ui component spec (forms, fields, validation)
4. Click **"Save All to Manifest"** to update that type's schema

### Remove or Re-add Types

- **Remove**: Select types with checkboxes, click "Remove Selected"
- **Re-add**: Go back to chat, ask the LLM, and save again

### Unlock for Editing

If you've already reviewed a type but need to change it:
1. Click **"Unlock"** on the reviewed type
2. Make changes (enhance, re-save)
3. Review again when ready

---

## 5. Generate Schemas

For entity types that don't have schemas yet (showing "missing" status), you can batch-generate them:

1. In the Manifest tab, click **"Generate All Schemas"**
2. Select your preferred LLM provider
3. The system generates schemas in parallel (default: 5 concurrent)
4. A **live progress feed** shows each schema as it completes
5. Each schema is saved to the database immediately (safe against connection drops)
6. The page reloads automatically when generation finishes

### What a Schema Looks Like

Schemas are ai-ui JSON specs — hierarchical component trees that the Renderer turns into interactive forms:

```json
{
  "type": "Container",
  "props": { "maxWidth": "4xl", "padding": "lg" },
  "children": [
    {
      "type": "Heading",
      "props": { "content": "Restaurant Details", "level": 2 }
    },
    {
      "type": "Input",
      "props": {
        "label": "Restaurant Name",
        "placeholder": "Enter name...",
        "bind": "restaurant_name"
      }
    },
    {
      "type": "Select",
      "props": {
        "label": "Cuisine Type",
        "options": ["Italian", "Chinese", "Mexican", "American"],
        "bind": "cuisine_type"
      }
    }
  ]
}
```

The `bind` prop connects each field to the form data store, so values are captured when saving.

---

## 6. Review and Lock

### Review Entity Types

Once schemas are generated and you're satisfied:

1. Select entity types using the checkboxes
2. Click **"Review Selected"**
3. Reviewed types show a green "reviewed" badge and cannot be modified unless unlocked

**All entity types must be reviewed before locking.**

### Lock the Container

When every entity type is reviewed and has a schema:

1. The **"Lock Container"** button appears
2. Click it and confirm the dialog
3. The system creates real `entity_types` rows in the database (scoped to this container)
4. Container status changes to **locked**
5. No further modifications to entity types are possible

### What Locking Does

- Persists entity types from the manifest into the `entity_types` table
- Links each type to the container via `container_id`
- Transitions status from review → **locked**
- Enables the "Launch App" button

---

## 7. Launch the App

With the container locked:

1. Click **"Launch App"** (the gold gradient button)
2. The system generates a URL-friendly **slug** from the container name
3. Container status changes to **launched**
4. You're redirected to **`/apps/{slug}`** — your live application

### What You Get

A fully functional application with:

- **App Dashboard** (`/apps/{slug}`) — stat cards per entity type, recent activity, quick-create buttons
- **Entity Lists** (`/apps/{slug}/{type}`) — paginated table with status filters, search
- **Create Forms** (`/apps/{slug}/{type}/new`) — interactive forms rendered from your schemas
- **Edit/View** (`/apps/{slug}/{type}/{id}`) — edit existing records or view in read-only mode
- **Sidebar Navigation** — generated from the container's manifest navigation structure
- **Separate Authentication** — app users are independent from platform admins

The launched app also appears as a card on the platform Dashboard at `/`.

---

## 8. App User Registration and Login

Launched apps have their own authentication system, separate from the platform.

### Self-Registration

1. Navigate to **`/apps/{slug}/login`**
2. Click **"Create account"** to switch to registration mode
3. Fill in name, email, and password (minimum 8 characters)
4. Submit — you're logged in and redirected to the app dashboard

Self-registered users get the **editor** role by default.

### Login

1. Navigate to **`/apps/{slug}/login`**
2. Enter email and password
3. Submit — redirected to `/apps/{slug}`

### Authentication Details

- App users get an `app_token` HTTP-only cookie (separate from the platform `token` cookie)
- Tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`)
- Email addresses are unique **per app** — the same email can register in different apps
- Inactive users (`is_active: false`) cannot log in

---

## 9. Managing App Users and Roles

### Role Hierarchy

| Role | Level | Permissions |
|------|-------|-------------|
| **viewer** | 1 | Read-only access to all entities |
| **editor** | 2 | Create and edit entities |
| **admin** | 3 | Full access + user management |

### Admin: List All Users

```bash
curl http://localhost:4321/api/v1/apps/{slug}/users \
  -H "Cookie: app_token={token}"
```

Only app admins or platform admins can access this endpoint.

### Admin: Invite a User

```bash
curl -X POST http://localhost:4321/api/v1/apps/{slug}/users \
  -H "Content-Type: application/json" \
  -H "Cookie: app_token={token}" \
  -d '{
    "email": "inspector@example.com",
    "name": "John Inspector",
    "role": "editor"
  }'
```

Response includes a **temporary password** that the admin shares with the invited user:

```json
{
  "user": { "id": "...", "email": "inspector@example.com", "role": "editor" },
  "tempPassword": "a1b2c3d4e5f6"
}
```

The invited user logs in with this temporary password at `/apps/{slug}/login`.

### Admin: Change a User's Role

```bash
curl -X PATCH http://localhost:4321/api/v1/apps/{slug}/users/{userId} \
  -H "Content-Type: application/json" \
  -H "Cookie: app_token={token}" \
  -d '{ "role": "admin" }'
```

### Admin: Deactivate a User

```bash
curl -X PATCH http://localhost:4321/api/v1/apps/{slug}/users/{userId} \
  -H "Content-Type: application/json" \
  -H "Cookie: app_token={token}" \
  -d '{ "is_active": false }'
```

Deactivated users cannot log in but their data is preserved.

### Admin: Remove a User

```bash
curl -X DELETE http://localhost:4321/api/v1/apps/{slug}/users/{userId} \
  -H "Cookie: app_token={token}"
```

---

## 10. Working with Entities

### Create a New Entity

1. From the app dashboard or sidebar, click a entity type
2. Click **"New {Type}"** button
3. Fill in the form (rendered from the entity type's schema)
4. Enter a name for the record
5. Click **Save**

The form uses the ai-ui Renderer — all 33 components are available: Input, Select, Checkbox, DatePicker, FileUpload, Table, Tabs, and more. Field values are bound via the `bind` prop to a reactive form data store.

### Edit an Entity

1. Click any entity in the list table
2. Modify fields in the form
3. Change status if needed (draft → active → review → approved → archived)
4. Click **Save**

### View an Entity (Read-Only)

Append `?mode=view` to the entity URL, or navigate from a read-only context. All form fields are disabled but data is displayed.

### File Uploads

Entity types can include `FileUpload` components. Files are uploaded to MinIO/S3 with presigned URLs and linked to the entity via `s3_key`.

---

## 11. Platform Admin Access

Platform admins (users created via `/api/v1/auth/register`) have special privileges:

- **Access any launched app** without an app-specific account — the system falls back to the platform token and grants admin-level access
- **Manage containers** — create, chat, lock, launch
- **View all entities** across the platform from the Dashboard
- **Access the Container Manager** at `/containers`

This means you don't need to create a separate app user for yourself — your platform admin account works everywhere.

---

## 12. API Reference

### Platform Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | None | Create platform user |
| POST | `/api/v1/auth/login` | None | Login, get token cookie |
| GET | `/api/v1/auth/me` | Token | Current user info |
| POST | `/api/v1/auth/logout` | None | Clear token cookie |

### Containers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/containers` | Token | List all containers |
| POST | `/api/v1/containers` | Token | Create container |
| GET | `/api/v1/containers/{id}` | Token | Get container + messages |
| PUT | `/api/v1/containers/{id}` | Token | Update container |
| DELETE | `/api/v1/containers/{id}` | Token | Delete container |
| POST | `/api/v1/containers/{id}/chat` | Token | Send chat message |
| POST | `/api/v1/containers/{id}/entity-types` | Token | Save entity types to manifest |
| DELETE | `/api/v1/containers/{id}/entity-types` | Token | Remove entity types |
| POST | `/api/v1/containers/{id}/review` | Token | Mark types as reviewed |
| POST | `/api/v1/containers/{id}/unlock` | Token | Unlock a reviewed type |
| POST | `/api/v1/containers/{id}/generate-schemas` | Token | Generate schemas (SSE) |
| POST | `/api/v1/containers/{id}/lock` | Token | Lock container |
| POST | `/api/v1/containers/{id}/launch` | Token | Launch as app |

### Entities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/entities` | Token | List entities (filterable) |
| POST | `/api/v1/entities` | Token | Create entity |
| GET | `/api/v1/entities/{id}` | Token | Get entity |
| PUT | `/api/v1/entities/{id}` | Token | Update entity |
| DELETE | `/api/v1/entities/{id}` | Token | Delete entity |
| GET | `/api/v1/entity-types` | Token | List entity types |

### App Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/apps/{slug}/auth/register` | None | Register app user |
| POST | `/api/v1/apps/{slug}/auth/login` | None | Login app user |
| GET | `/api/v1/apps/{slug}/auth/me` | App token | Current app user |
| POST | `/api/v1/apps/{slug}/auth/logout` | None | Clear app token |

### App User Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/apps/{slug}/users` | Admin | List app users |
| POST | `/api/v1/apps/{slug}/users` | Admin | Invite user (returns temp password) |
| PATCH | `/api/v1/apps/{slug}/users/{id}` | Admin | Update role / active status |
| DELETE | `/api/v1/apps/{slug}/users/{id}` | Admin | Remove user |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | None | DB connectivity check |

---

## 13. Docker Production Deployment

### Full Stack with Docker Compose

```bash
# Build and start everything
docker-compose up -d

# Check health
curl http://localhost:4321/api/health
```

This starts three services:
- **app** — Astro SSR on port 4321 (auto-runs migrations on startup)
- **postgres** — PostgreSQL 17 on port 5433
- **minio** — S3-compatible storage on ports 9000 (API) / 9001 (console)

### Production Checklist

1. **Change `JWT_SECRET`** — generate a strong random string (64+ characters)
2. **Change database credentials** — use strong passwords
3. **Set `NODE_ENV=production`** — enables secure cookies and env validation
4. **Set `BASE_URL`** — your production domain
5. **Configure LLM keys** — at least one provider for container chat
6. **Set up S3** — either keep MinIO or point to AWS S3 / compatible service
7. **TLS termination** — put a reverse proxy (nginx, Caddy) in front for HTTPS

### Building the Docker Image

```bash
docker build -t ai-ui .
```

The multi-stage Dockerfile:
1. Installs dependencies with Bun
2. Runs `bun run build` (Astro production build)
3. Creates a minimal runtime image
4. Starts with `bun run scripts/start.ts` (migrate + serve)

---

## Quick Reference: Container Lifecycle

```
┌─────────┐    Chat &     ┌─────────┐   Generate    ┌─────────┐
│  draft   │──  Save   ──→│ review  │──  Schemas  ──→│ review  │
│         │   Entity      │         │   + Review     │  (all   │
│  Chat   │   Types       │ Manifest│   All Types    │reviewed)│
└─────────┘               └─────────┘               └────┬────┘
                                                          │
                                                     Lock │
                                                          ▼
                          ┌─────────┐    Launch     ┌─────────┐
                          │launched │◄──────────────│ locked  │
                          │         │               │         │
                          │/apps/   │               │ Entity  │
                          │ {slug}  │               │  types  │
                          └─────────┘               │ in DB   │
                                                    └─────────┘
```

### Container Status Summary

| Status | What You Can Do |
|--------|----------------|
| **draft** | Chat with LLM, save entity types, modify freely |
| **review** | Same as draft — review and refine entity types |
| **locked** | No modifications. Entity types persisted to DB. Can launch. |
| **launched** | Live app at `/apps/{slug}`. Users can register and use it. |
