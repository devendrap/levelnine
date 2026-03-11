-- Step 3: Type Materialization — enrich entity_types with data_schema, field_metadata, related_types, document_slots, report_relevance
-- These fields are generated alongside ui_spec (schema) during schema generation, zero extra LLM calls

ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS data_schema JSONB;
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS field_metadata JSONB;
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS related_types JSONB;
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS document_slots JSONB;
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS report_relevance JSONB;
