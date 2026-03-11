-- D9: Container notification rules (materialized on gate approval)
CREATE TABLE IF NOT EXISTS container_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_entity_type VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(50) NOT NULL
    CHECK (trigger_event IN ('status_change', 'created', 'updated', 'field_change', 'sla_breach')),
  trigger_condition TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  channel VARCHAR(50) NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('email', 'in_app', 'both')),
  escalation_minutes INT,
  escalation_to VARCHAR(255),
  template TEXT,
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

CREATE INDEX IF NOT EXISTS idx_container_notifications_cid ON container_notifications(container_id);

CREATE TRIGGER trg_container_notifications_updated_at
  BEFORE UPDATE ON container_notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- D10: Container UI configs (materialized on gate approval)
CREATE TABLE IF NOT EXISTS container_ui_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255) NOT NULL,
  view_type VARCHAR(50) NOT NULL DEFAULT 'master_detail'
    CHECK (view_type IN ('master_detail', 'full_page', 'dashboard', 'grid_only')),
  grid_config JSONB NOT NULL DEFAULT '{}',
  detail_config JSONB NOT NULL DEFAULT '{}',
  navigation JSONB NOT NULL DEFAULT '{}',
  source_dimension VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name)
);

CREATE INDEX IF NOT EXISTS idx_container_ui_configs_cid ON container_ui_configs(container_id);
CREATE INDEX IF NOT EXISTS idx_container_ui_configs_entity ON container_ui_configs(entity_type);

CREATE TRIGGER trg_container_ui_configs_updated_at
  BEFORE UPDATE ON container_ui_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- C2: Notification engine tables
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('email', 'in_app')),
  subject TEXT,
  body_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, name, channel)
);

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('email', 'in_app')),
  subject TEXT,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'read', 'failed')),
  entity_id UUID,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient ON notification_queue(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_container ON notification_queue(container_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL DEFAULT 'in_app',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, container_id, channel)
);

CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- C4: Data classifications (field-level security)
CREATE TABLE IF NOT EXISTS data_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  entity_type VARCHAR(255) NOT NULL,
  field_path VARCHAR(500) NOT NULL,
  classification VARCHAR(50) NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('public', 'internal', 'confidential', 'pii')),
  mask_for_roles JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_id, entity_type, field_path)
);

CREATE INDEX IF NOT EXISTS idx_data_classifications_container ON data_classifications(container_id);

CREATE TRIGGER trg_data_classifications_updated_at
  BEFORE UPDATE ON data_classifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed D9 and D10 into dimension_configs
INSERT INTO dimension_configs (dimension, label, description, system_prompt, sort_order) VALUES
('notifications', 'Notifications & Alerts', 'Notification rules, escalation chains, SLA timers, and alert triggers per role and workflow',
 'Define all notification rules for this application. For each entity type with workflows, determine: who gets notified on status changes? What are the SLA timers (e.g., must be reviewed within 48 hours)? What escalation paths exist if SLAs are breached? What channels (email, in-app) are appropriate for each notification? Reference specific roles from the Roles dimension and specific workflow transitions from the Workflows dimension.',
 9),
('ui_navigation', 'UI & Navigation', 'Application screen layouts, master-detail configs, grid columns, detail panels, navigation hierarchy',
 'Design the application UI for each entity type. Decide whether each entity uses master-detail layout (grid on left, detail on right with single-click selection) or full-page view. For master-detail views: define grid columns (field, label, width, sortable), the split ratio (browse-heavy=60/40, detail-heavy=30/70), and detail panel layout (tabs or accordion with sections). For navigation: organize entity types into menu groups with sort order. Consider the roles defined earlier — different roles may need different default views. Use breadcrumb navigation for nested entities.',
 10)
ON CONFLICT (dimension) DO NOTHING;
