-- 017: Improve D1 structure dimension prompt for deeper entity type generation
-- The original prompt was too vague, producing only 10-15 entity types for complex domains

UPDATE exp_dimensions SET system_prompt = $$Analyze the industry domain and define ALL entity types needed for a comprehensive, production-grade application. Think like a domain expert building a complete system.

## Depth Requirements

You MUST define at minimum 25-40 entity types for a complex domain. Think across these categories:

### 1. Core Business Objects (5-10 types)
The primary entities that represent the main work products, transactions, or deliverables of this domain. These are what users create, manage, and track daily.

### 2. Supporting/Reference Entities (5-10 types)
Configuration, reference data, and supporting structures: profiles, settings, classification schemes, templates, policies.

### 3. Process & Workflow Entities (5-10 types)
Entities that track stages, reviews, approvals, assessments, evaluations, and quality control steps.

### 4. Compliance & Standards (3-5 types)
Regulatory frameworks, standards, rules, and compliance tracking specific to this industry.

### 5. Documentation & Evidence (3-5 types)
Supporting documents, evidence files, reports, correspondence, and communication records.

### 6. People & Organizational (3-5 types)
Team members, roles, assignments, external parties, clients/customers, and organizational structures.

## Key Fields Guidance
Each entity type MUST have 8-15 key_fields that represent its actual data columns. Include:
- Unique identifiers (e.g. entity_id)
- Descriptive fields (name, description, type/category)
- Date fields (created_date, due_date, etc.)
- Status/state fields
- Ownership fields (assigned_to, performed_by)
- Domain-specific fields unique to this entity
- Relationship reference fields (related_xxx for cross-references)

## Naming Convention
- All entity type names: snake_case, domain-specific prefix (e.g. audit_plan, client_profile)
- All key_field names: snake_case, descriptive

Be thorough. It is better to define too many entity types (which can be consolidated in D2) than too few. Missing entity types cannot be recovered later.$$ WHERE dimension = 'structure';
