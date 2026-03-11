-- C3: Validation Rules — business-rule validation beyond Zod schemas
CREATE TABLE IF NOT EXISTS validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  entity_type VARCHAR(255) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL
    CHECK (rule_type IN ('field', 'cross_field', 'cross_entity')),
  expression JSONB NOT NULL,
  error_message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'error'
    CHECK (severity IN ('error', 'warning')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, entity_type, rule_name)
);

CREATE INDEX IF NOT EXISTS idx_validation_rules_container ON validation_rules(container_id);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(entity_type);

CREATE TRIGGER trg_validation_rules_updated_at
  BEFORE UPDATE ON validation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- C5: Lifecycle Policies — automated data lifecycle management
CREATE TABLE IF NOT EXISTS lifecycle_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  entity_type VARCHAR(255) NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL
    CHECK (trigger_type IN ('age', 'status', 'manual')),
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('archive', 'soft_delete', 'hard_delete', 'export')),
  retention_days INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, entity_type, policy_name)
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_policies_container ON lifecycle_policies(container_id);

CREATE TRIGGER trg_lifecycle_policies_updated_at
  BEFORE UPDATE ON lifecycle_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
