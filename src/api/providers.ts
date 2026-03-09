import OpenAI from 'openai'

export type Provider = 'ollama' | 'openai' | 'xai' | 'gemini' | 'mistral'

const defaults: Record<Provider, { baseURL: string; model: string; envKey: string }> = {
  ollama:   { baseURL: 'http://localhost:11434/v1', model: 'devstral-small-2:24b-cloud', envKey: '' },
  openai:   { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', envKey: 'OPENAI_API_KEY' },
  xai:      { baseURL: 'https://api.x.ai/v1', model: 'grok-3-mini', envKey: 'XAI_API_KEY' },
  gemini:   { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  mistral:  { baseURL: 'http://localhost:11434/v1', model: 'devstral-small-2:24b-cloud', envKey: '' },
}

export function getClient(provider: Provider): { client: OpenAI; model: string } {
  const cfg = defaults[provider]
  if (!cfg) throw new Error(`Unknown provider: ${provider}. Available: ${Object.keys(defaults).join(', ')}`)

  const apiKey = cfg.envKey ? process.env[cfg.envKey] : 'ollama'
  if (cfg.envKey && !apiKey) throw new Error(`Missing env var: ${cfg.envKey}`)

  return {
    client: new OpenAI({ baseURL: cfg.baseURL, apiKey }),
    model: cfg.model,
  }
}

export function getModel(provider: Provider, model?: string): string {
  return model ?? defaults[provider]?.model ?? 'gpt-4o'
}
