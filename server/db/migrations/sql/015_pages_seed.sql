-- 015: Container Pages + D11 dimension
-- Custom pages (LLM-generated dashboards, analytics views) + seed data support

CREATE TABLE container_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  route VARCHAR(255) NOT NULL,
  icon VARCHAR(100),
  layout VARCHAR(50) NOT NULL DEFAULT 'single'
    CHECK (layout IN ('single', 'two_column', 'grid')),
  sections JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  access_roles JSONB,
  sort_order INT NOT NULL DEFAULT 99,
  source_dimension VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

CREATE INDEX idx_container_pages_container ON container_pages(container_id);
CREATE INDEX idx_container_pages_route ON container_pages(container_id, route);

-- D11: Pages & Dashboard dimension
INSERT INTO dimension_configs (dimension, label, description, system_prompt, sort_order, is_active) VALUES
('pages_dashboard', 'Pages & Dashboard', 'Design purpose-built pages (Home dashboard, analytics, calendar) and generate seed data with realistic industry-specific values',
$$Design purpose-built pages for this industry application. You have access to everything defined in D1-D10.

## What to Generate

### 1. Custom Pages
At minimum, create a **Home** page (is_default: true) that replaces the generic entity list dashboard. The Home page should include:
- KPI cards showing key metrics (entity counts, status distributions)
- A chart showing important trends or distributions
- Recent activity feed
- Quick action buttons for the most common tasks

Also create 2-4 domain-specific pages such as:
- **Analytics** — charts and metrics relevant to this industry
- **Calendar/Timeline** — if the domain has time-sensitive workflows
- **Team Overview** — if roles and assignments matter
- **Reports** — if the domain has compliance or reporting needs

### 2. Seed Data
Generate 3-5 realistic sample records for each key entity type. Use:
- Real-sounding names (not "Test Record 1")
- Appropriate statuses (mix of draft, active, review, approved)
- Industry-specific field values that make sense together
- Dates and numbers that are plausible

## Page Structure

Each page has sections with widgets. Available widget types:

- **stats_grid** — shows entity type counts as cards
  props: { entity_types: ["type1", "type2"] }

- **recent_activity** — latest entities across types
  props: { limit?: number }

- **chart** — bar/line/doughnut chart
  props: { chart_type: "bar"|"line"|"doughnut"|"pie", entity_type: string, group_by: string, title: string }

- **entity_list** — filtered table of entities
  props: { entity_type: string, columns: string[], limit?: number, status_filter?: string }

- **quick_actions** — create buttons for entity types
  props: { entity_types: ["type1", "type2"] }

- **kpi_card** — single metric
  props: { label: string, entity_type: string, metric: "count"|"count_by_status", status?: string }

- **rich_text** — static content using LevelNine Renderer JSON
  props: { content: { type: "Container", props: {...}, children: [...] } }

- **workflow_summary** — status distribution for a workflow
  props: { entity_type: string, workflow_name: string }

- **compliance_checklist** — checkpoint progress
  props: { compliance_name: string }

## Output Format

Include pages and seed_data in your exploration output JSON.$$,
12, true);
