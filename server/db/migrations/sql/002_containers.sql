-- Containers: industry container definitions created via admin chat
CREATE TABLE IF NOT EXISTS containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'locked')),
  manifest JSONB NOT NULL DEFAULT '{}',
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Container chat messages: conversation history for each container
CREATE TABLE IF NOT EXISTS container_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_messages_container ON container_messages(container_id, created_at);

-- Reuse the updated_at trigger from 001
CREATE TRIGGER trg_containers_updated_at BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
