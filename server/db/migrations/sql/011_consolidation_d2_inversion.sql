-- Phase A: D0.5 Consolidation dimension + D2 prompt inversion
-- Step 1: Insert consolidation dimension between D1 (structure) and D2 (roles)
-- Step 2: Invert D2 from allowlist to denylist (restricted_entity_types)

-- 1. Shift all dimensions with sort_order >= 2 up by 1 to make room for consolidation
UPDATE dimension_configs SET sort_order = sort_order + 1 WHERE sort_order >= 2;

-- 2. Insert consolidation dimension at sort_order = 2 (between structure=1 and roles=3)
INSERT INTO dimension_configs (dimension, label, description, system_prompt, sort_order) VALUES
('consolidation', 'Consolidation', 'Review and merge entity types — collapse enums/lookups into parent fields, remove infrastructure duplication, target 30-40 core domain types',
'Review ALL entity types in the manifest. Your goal is to reduce entity explosion by merging and consolidating.

MERGE RULES:
1. **Enum/Lookup types** → Merge into parent entity as an enum field. Example: "audit_status" type with values [draft, active, complete] becomes a "status" field on "audit_engagement" with enum constraint.
2. **Infrastructure types** that duplicate platform features → REMOVE. The platform provides: users, roles, permissions, file storage, notifications, audit trail. Do not create entity types for these.
3. **Overlapping types** → Merge into a single type. Example: "internal_audit_finding" and "external_audit_finding" become "audit_finding" with a "source" enum field.
4. **Junction/bridge types** → Only keep if they carry data beyond the two FKs. Pure many-to-many joins are handled by the platform relations system.

TARGET: 30-40 core domain types. If the current count is already in range, validate and confirm.

For each removal, explain which parent type absorbs it and how (new field, enum value, etc).
For each merge, explain what the combined type looks like.', 2)
ON CONFLICT (dimension) DO NOTHING;

-- 3. Update D2 (roles) system_prompt — invert from allowlist to denylist
UPDATE dimension_configs
SET system_prompt = 'Define all user roles for this domain. For each role, specify:
- Name, label, description
- Permissions as action:resource pairs (e.g., "create:audit_engagement", "approve:finding")

ACCESS MODEL: Every role can access ALL entity types by default. Only specify RESTRICTIONS — entity types this role should NOT see. Most roles should have zero or very few restrictions. Only restrict access when there is a clear business reason (e.g., external auditors should not see internal HR records).

Provide a "restriction_justification" for each restricted type explaining the business reason.

Think about: who creates, reviews, approves, and audits each entity type. Consider supervisory hierarchies and segregation of duties.'
WHERE dimension = 'roles';

-- 4. Rename can_access_entity_types → restricted_entity_types in container_roles
ALTER TABLE container_roles RENAME COLUMN can_access_entity_types TO restricted_entity_types;
