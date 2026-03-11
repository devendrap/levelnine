-- Add domain_role column to app_users for mapping to container_roles
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS domain_role VARCHAR(255);

-- Index for looking up users by domain role within a container
CREATE INDEX IF NOT EXISTS idx_app_users_domain_role ON app_users(container_id, domain_role);
