import { atom, computed } from 'nanostores'

/** LLM provider — synced from the provider-select dropdown in ContainerHeader */
export const $provider = atom('ollama')

/** Schema generation progress — shared across ManifestTableIsland, header, and sidebar */
export const $manifestTotal = atom(0)
export const $manifestSchemaReady = atom(0)
export const $manifestReviewed = atom(0)
export const $manifestGenerating = atom(false)

export const $manifestSummary = computed(
  [$manifestTotal, $manifestSchemaReady, $manifestReviewed, $manifestGenerating],
  (total, ready, reviewed, generating) => ({ total, ready, reviewed, generating }),
)
