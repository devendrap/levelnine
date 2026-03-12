-- Fix missing ON DELETE CASCADE on entity_types and entities container_id FKs
-- (migration 003 added these without CASCADE, unlike all other container-referencing tables)

ALTER TABLE entity_types DROP CONSTRAINT entity_types_container_id_fkey;
ALTER TABLE entity_types ADD CONSTRAINT entity_types_container_id_fkey
  FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE;

ALTER TABLE entities DROP CONSTRAINT entities_container_id_fkey;
ALTER TABLE entities ADD CONSTRAINT entities_container_id_fkey
  FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE;
