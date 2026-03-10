-- ============================================================================
-- Step 1: App Launch — container_id scoping + slug + launched status
-- ============================================================================

-- Allow 'launched' status on containers, add slug
ALTER TABLE containers DROP CONSTRAINT IF EXISTS containers_status_check;
ALTER TABLE containers ADD CONSTRAINT containers_status_check
  CHECK (status IN ('draft', 'review', 'locked', 'launched'));
ALTER TABLE containers ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- Link entity_types to source container
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS container_id UUID REFERENCES containers(id);

-- Change unique constraint: same name allowed across different containers
ALTER TABLE entity_types DROP CONSTRAINT IF EXISTS entity_types_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_types_name_container
  ON entity_types (name, COALESCE(container_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_entity_types_container ON entity_types(container_id);

-- Link entities to container for app scoping
ALTER TABLE entities ADD COLUMN IF NOT EXISTS container_id UUID REFERENCES containers(id);
CREATE INDEX IF NOT EXISTS idx_entities_container ON entities(container_id);
