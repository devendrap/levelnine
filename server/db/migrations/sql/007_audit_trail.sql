-- C1: Audit Trail — automatic change tracking for all entities
-- Uses a Postgres trigger so app code never needs to explicitly log

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type_id UUID,
  container_id UUID,
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('create', 'update', 'delete', 'status_change')),
  field_changes JSONB NOT NULL DEFAULT '{}',
  old_values JSONB NOT NULL DEFAULT '{}',
  new_values JSONB NOT NULL DEFAULT '{}',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_container ON audit_log(container_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- Trigger function: captures INSERT, UPDATE, DELETE on entities
CREATE OR REPLACE FUNCTION fn_audit_entities()
RETURNS TRIGGER AS $$
DECLARE
  v_action VARCHAR(50);
  v_changes JSONB := '{}';
  v_old JSONB := '{}';
  v_new JSONB := '{}';
  v_entity_id UUID;
  v_entity_type_id UUID;
  v_container_id UUID;
  v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_entity_id := NEW.id;
    v_entity_type_id := NEW.entity_type_id;
    v_container_id := NEW.container_id;
    v_user_id := NEW.created_by_user_id;
    v_new := to_jsonb(NEW) - 'created_at' - 'updated_at';
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_entity_type_id := NEW.entity_type_id;
    v_container_id := NEW.container_id;
    v_user_id := NEW.last_modified_by_user_id;

    -- Detect status change specifically
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_change';
    ELSE
      v_action := 'update';
    END IF;

    -- Build diff of changed fields (skip timestamps)
    SELECT jsonb_object_agg(key, value) INTO v_changes
    FROM jsonb_each(to_jsonb(NEW) - 'created_at' - 'updated_at')
    WHERE value IS DISTINCT FROM (to_jsonb(OLD) -> key);

    v_old := to_jsonb(OLD) - 'created_at' - 'updated_at';
    v_new := to_jsonb(NEW) - 'created_at' - 'updated_at';

    -- Skip if nothing actually changed
    IF v_changes IS NULL OR v_changes = '{}' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_entity_type_id := OLD.entity_type_id;
    v_container_id := OLD.container_id;
    v_user_id := OLD.last_modified_by_user_id;
    v_old := to_jsonb(OLD) - 'created_at' - 'updated_at';
  END IF;

  INSERT INTO audit_log (entity_id, entity_type_id, container_id, action, field_changes, old_values, new_values, user_id)
  VALUES (v_entity_id, v_entity_type_id, v_container_id, v_action, COALESCE(v_changes, '{}'), v_old, v_new, v_user_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to entities table
DROP TRIGGER IF EXISTS trg_audit_entities ON entities;
CREATE TRIGGER trg_audit_entities
  AFTER INSERT OR UPDATE OR DELETE ON entities
  FOR EACH ROW EXECUTE FUNCTION fn_audit_entities();
