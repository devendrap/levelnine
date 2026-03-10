-- Exploration loop & entity relations
-- Replaces parent_entity_id with generic entity_relations table
-- Adds exploration tracking tables + dimension configs

-- 1. Entity Relations (generic many-to-many)
CREATE TABLE IF NOT EXISTS entity_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_entity_id, target_entity_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_relations_source ON entity_relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_target ON entity_relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_type ON entity_relations(relation_type);

-- 2. Migrate existing parent_entity_id data to entity_relations
INSERT INTO entity_relations (source_entity_id, target_entity_id, relation_type)
SELECT parent_entity_id, id, 'parent'
FROM entities
WHERE parent_entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop parent_entity_id column and index
DROP INDEX IF EXISTS idx_entities_parent;
ALTER TABLE entities DROP COLUMN IF EXISTS parent_entity_id;

-- 4. Dimension configs (per-dimension prompts)
CREATE TABLE IF NOT EXISTS dimension_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 8 dimensions
INSERT INTO dimension_configs (dimension, label, description, system_prompt, sort_order) VALUES
('structure', 'Structure', 'Core entity types, data models, and organizational hierarchy', 'Analyze the industry domain and define the core entity types, their data models, and organizational hierarchy. Focus on what data needs to be captured, stored, and managed. Think about the fundamental building blocks of this domain.', 1),
('roles', 'Roles & Access', 'User roles, permissions, and access control patterns', 'Define all user roles, their responsibilities, permission levels, and access control patterns. Consider who creates, reviews, approves, and audits each entity type. Map the authorization matrix.', 2),
('workflows', 'Workflows', 'Business processes, state machines, and approval chains', 'Map out all business processes, state transitions, approval chains, and workflow automations. Define what triggers each workflow, who participates, and what the outcomes are. Include exception handling flows.', 3),
('compliance', 'Compliance', 'Regulatory requirements, standards, and audit trails', 'Identify all regulatory requirements, industry standards, compliance checkpoints, and audit trail needs. Reference specific regulations by number. Define what evidence must be captured and retained.', 4),
('documents', 'Documents', 'Document types, templates, versioning, and retention', 'Define all document types, templates, versioning requirements, and retention policies. Consider generated reports, uploaded evidence, signed attestations, and archival requirements.', 5),
('integrations', 'Integrations', 'External systems, APIs, data imports/exports', 'Identify all external system integrations, API connections, data import/export requirements, and synchronization patterns. Consider ERP, CRM, regulatory filing systems, and third-party data sources.', 6),
('reporting', 'Reporting', 'Dashboards, analytics, KPIs, and scheduled reports', 'Define all reporting requirements: dashboards, KPIs, analytics views, scheduled reports, and ad-hoc query needs. Consider management reporting, regulatory reporting, and operational metrics.', 7),
('edge_cases', 'Edge Cases', 'Exception handling, error recovery, and boundary conditions', 'Identify edge cases, exception scenarios, error recovery procedures, and boundary conditions. Think about what could go wrong, data quality issues, concurrent access problems, and disaster recovery.', 8)
ON CONFLICT (dimension) DO NOTHING;

-- Updated_at trigger for dimension_configs
CREATE OR REPLACE FUNCTION update_dimension_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_dimension_configs_updated_at ON dimension_configs;
CREATE TRIGGER trigger_dimension_configs_updated_at
  BEFORE UPDATE ON dimension_configs
  FOR EACH ROW EXECUTE FUNCTION update_dimension_configs_updated_at();

-- 5. Exploration runs (tracks each pass per container)
CREATE TABLE IF NOT EXISTS exploration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  phase VARCHAR(50) NOT NULL DEFAULT 'first_pass'
    CHECK (phase IN ('first_pass', 'holistic_review', 'explore', 'locked')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_dimension VARCHAR(50) REFERENCES dimension_configs(dimension),
  current_step VARCHAR(50) DEFAULT 'generate'
    CHECK (current_step IN ('generate', 'self_review', 'gaps', 'gate')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exploration_runs_container ON exploration_runs(container_id);

-- 6. Exploration steps (each step within a dimension)
CREATE TABLE IF NOT EXISTS exploration_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES exploration_runs(id) ON DELETE CASCADE,
  dimension VARCHAR(50) NOT NULL,
  step VARCHAR(50) NOT NULL
    CHECK (step IN ('generate', 'self_review', 'gaps', 'gate')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'skipped', 'error')),
  llm_output TEXT,
  entity_types_added JSONB NOT NULL DEFAULT '[]',
  entity_types_modified JSONB NOT NULL DEFAULT '[]',
  relations_added JSONB NOT NULL DEFAULT '[]',
  relations_modified JSONB NOT NULL DEFAULT '[]',
  explore_opportunities JSONB NOT NULL DEFAULT '[]',
  out_of_scope_items JSONB NOT NULL DEFAULT '[]',
  gate_decision VARCHAR(50)
    CHECK (gate_decision IN ('continue', 'go_deeper', 'skip', 'stop')),
  gate_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exploration_steps_run ON exploration_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_exploration_steps_dimension ON exploration_steps(dimension);

-- 7. Manifest snapshots (full manifest after each dimension)
CREATE TABLE IF NOT EXISTS manifest_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES exploration_runs(id) ON DELETE CASCADE,
  dimension VARCHAR(50) NOT NULL,
  manifest JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manifest_snapshots_container ON manifest_snapshots(container_id);
CREATE INDEX IF NOT EXISTS idx_manifest_snapshots_run ON manifest_snapshots(run_id);
