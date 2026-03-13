-- 019: App-level AI assistant chat messages
-- Stores conversation history per user per page context within an app

CREATE TABLE IF NOT EXISTS app_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_context JSONB NOT NULL DEFAULT '{}',
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  tool_calls JSONB,
  tool_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_chat_container_user
  ON app_chat_messages(container_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_app_chat_page_context
  ON app_chat_messages USING gin(page_context);
