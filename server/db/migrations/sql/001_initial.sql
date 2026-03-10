-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Users
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'staff'
    CHECK (role IN ('admin', 'partner', 'manager', 'staff', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- ============================================================================
-- Entity Types — schema registry (stores ai-ui spec templates)
-- ============================================================================
CREATE TABLE entity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  schema JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_types_name ON entity_types (name);

-- ============================================================================
-- Entities — all domain objects
-- ============================================================================
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type_id UUID NOT NULL REFERENCES entity_types(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'review', 'approved', 'archived')),
  content JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  parent_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  period TEXT,
  s3_key VARCHAR(512),
  original_filename VARCHAR(255),
  processing_status VARCHAR(50) DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'complete', 'error')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_modified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_type ON entities (entity_type_id);
CREATE INDEX idx_entities_parent ON entities (parent_entity_id);
CREATE INDEX idx_entities_status ON entities (status);
CREATE INDEX idx_entities_period ON entities (period);
CREATE INDEX idx_entities_created_by ON entities (created_by_user_id);

-- ============================================================================
-- Updated-at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_entity_types_updated_at
  BEFORE UPDATE ON entity_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
