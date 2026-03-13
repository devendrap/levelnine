-- Fix audit trigger function to use renamed sys_audit_log table
-- Migration 016 renamed audit_log -> sys_audit_log but didn't update the trigger function body

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

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_change';
    ELSE
      v_action := 'update';
    END IF;

    SELECT jsonb_object_agg(key, value) INTO v_changes
    FROM jsonb_each(to_jsonb(NEW) - 'created_at' - 'updated_at')
    WHERE value IS DISTINCT FROM (to_jsonb(OLD) -> key);

    v_old := to_jsonb(OLD) - 'created_at' - 'updated_at';
    v_new := to_jsonb(NEW) - 'created_at' - 'updated_at';

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

  INSERT INTO sys_audit_log (entity_id, entity_type_id, container_id, action, field_changes, old_values, new_values, user_id)
  VALUES (v_entity_id, v_entity_type_id, v_container_id, v_action, COALESCE(v_changes, '{}'), v_old, v_new, v_user_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
