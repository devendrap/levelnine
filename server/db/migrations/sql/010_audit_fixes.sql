-- 010: Audit fixes — indexes, constraints, triggers
-- Addresses issues found in technical audit

-- 2.1: Unique constraint on entity names within a type
ALTER TABLE entities ADD CONSTRAINT uq_entity_type_name UNIQUE(entity_type_id, name);

-- 3.4: Composite index on exploration_steps for (run_id, dimension, step)
CREATE INDEX IF NOT EXISTS idx_exploration_steps_run_dim_step
  ON exploration_steps(run_id, dimension, step);

-- 3.5: Missing FK indexes
CREATE INDEX IF NOT EXISTS idx_containers_created_by ON containers(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_invited_by ON app_users(invited_by);

-- 3.6: Missing updated_at triggers
CREATE TRIGGER trg_app_users_updated_at BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE TRIGGER trg_notification_queue_updated_at BEFORE UPDATE ON notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE TRIGGER trg_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3.7: Fix missing ON DELETE actions for nullable FKs
ALTER TABLE containers DROP CONSTRAINT IF EXISTS containers_created_by_user_id_fkey;
ALTER TABLE containers ADD CONSTRAINT containers_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_invited_by_fkey;
ALTER TABLE app_users ADD CONSTRAINT app_users_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
