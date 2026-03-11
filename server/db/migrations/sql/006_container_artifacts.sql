-- Container-scoped artifact tables
-- Populated on gate approval (not lock), one dimension at a time

-- D1: Type-level relations (schema-time, not entity-instance relations)
CREATE TABLE IF NOT EXISTS container_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  source_type VARCHAR(255) NOT NULL,
  target_type VARCHAR(255) NOT NULL,
  relation_type VARCHAR(100) NOT NULL,
  description TEXT,
  source_dimension VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, source_type, target_type, relation_type)
);

-- D2: Roles & permissions
CREATE TABLE IF NOT EXISTS container_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]',
  can_access_entity_types JSONB NOT NULL DEFAULT '[]',
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- D3: Workflows & state machines
CREATE TABLE IF NOT EXISTS container_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  entity_type VARCHAR(255) NOT NULL,
  statuses JSONB NOT NULL DEFAULT '[]',
  transitions JSONB NOT NULL DEFAULT '[]',
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- D4: Compliance mappings
CREATE TABLE IF NOT EXISTS container_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  standard VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  entity_types JSONB NOT NULL DEFAULT '[]',
  checkpoints JSONB NOT NULL DEFAULT '[]',
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- D5: Document templates
CREATE TABLE IF NOT EXISTS container_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  entity_type VARCHAR(255),
  format VARCHAR(50) NOT NULL DEFAULT 'pdf',
  retention_days INT,
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- D6: Integration configs
CREATE TABLE IF NOT EXISTS container_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_type VARCHAR(100) NOT NULL,
  direction VARCHAR(50) NOT NULL DEFAULT 'import',
  entity_types JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- D7: Report specs
CREATE TABLE IF NOT EXISTS container_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  report_type VARCHAR(50) NOT NULL DEFAULT 'dashboard',
  entity_types JSONB NOT NULL DEFAULT '[]',
  schema JSONB,
  schedule VARCHAR(100),
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- D8: Edge case configs
CREATE TABLE IF NOT EXISTS container_edge_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT 'exception',
  entity_types JSONB NOT NULL DEFAULT '[]',
  handling TEXT NOT NULL DEFAULT '',
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_container_relations_cid ON container_relations(container_id);
CREATE INDEX IF NOT EXISTS idx_container_roles_cid ON container_roles(container_id);
CREATE INDEX IF NOT EXISTS idx_container_workflows_cid ON container_workflows(container_id);
CREATE INDEX IF NOT EXISTS idx_container_compliance_cid ON container_compliance(container_id);
CREATE INDEX IF NOT EXISTS idx_container_documents_cid ON container_documents(container_id);
CREATE INDEX IF NOT EXISTS idx_container_integrations_cid ON container_integrations(container_id);
CREATE INDEX IF NOT EXISTS idx_container_reports_cid ON container_reports(container_id);
CREATE INDEX IF NOT EXISTS idx_container_edge_cases_cid ON container_edge_cases(container_id);

-- Updated_at triggers (reuse existing function from 001_initial)
CREATE TRIGGER trg_container_roles_updated_at BEFORE UPDATE ON container_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_container_workflows_updated_at BEFORE UPDATE ON container_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_container_compliance_updated_at BEFORE UPDATE ON container_compliance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_container_documents_updated_at BEFORE UPDATE ON container_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_container_integrations_updated_at BEFORE UPDATE ON container_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_container_reports_updated_at BEFORE UPDATE ON container_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_container_edge_cases_updated_at BEFORE UPDATE ON container_edge_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
