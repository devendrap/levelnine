-- 016: Table naming convention — prefix by layer
-- cfg_  = artifact config (written by platform, read by app)
-- exp_  = exploration engine
-- app_  = app runtime
-- sys_  = system/infra
-- chat_ = chat history
-- (no prefix) = core tables (containers, entity_types, entities, users, etc.)

-- Artifact config tables: container_* → cfg_*
ALTER TABLE container_relations RENAME TO cfg_relations;
ALTER TABLE container_roles RENAME TO cfg_roles;
ALTER TABLE container_workflows RENAME TO cfg_workflows;
ALTER TABLE container_compliance RENAME TO cfg_compliance;
ALTER TABLE container_documents RENAME TO cfg_documents;
ALTER TABLE container_integrations RENAME TO cfg_integrations;
ALTER TABLE container_reports RENAME TO cfg_reports;
ALTER TABLE container_edge_cases RENAME TO cfg_edge_cases;
ALTER TABLE container_notifications RENAME TO cfg_notifications;
ALTER TABLE container_ui_configs RENAME TO cfg_ui_configs;
ALTER TABLE container_pages RENAME TO cfg_pages;
ALTER INDEX idx_container_pages_container RENAME TO idx_cfg_pages_container;
ALTER INDEX idx_container_pages_route RENAME TO idx_cfg_pages_route;

-- Chat
ALTER TABLE container_messages RENAME TO chat_messages;

-- Exploration
ALTER TABLE dimension_configs RENAME TO exp_dimensions;
ALTER TABLE exploration_runs RENAME TO exp_runs;
ALTER TABLE exploration_steps RENAME TO exp_steps;
ALTER TABLE manifest_snapshots RENAME TO exp_snapshots;

-- App runtime
ALTER TABLE notification_queue RENAME TO app_notifications;
ALTER TABLE notification_preferences RENAME TO app_notification_prefs;
ALTER TABLE notification_templates RENAME TO app_notification_templates;

-- System (NOT renaming _migrations here — handled by migrate.ts after this migration)
ALTER TABLE audit_log RENAME TO sys_audit_log;
ALTER TABLE validation_rules RENAME TO sys_validation_rules;
ALTER TABLE lifecycle_policies RENAME TO sys_lifecycle_policies;
ALTER TABLE data_classifications RENAME TO sys_data_classifications;
