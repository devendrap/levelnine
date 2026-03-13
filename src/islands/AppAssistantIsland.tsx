import { Show, onMount } from 'solid-js'
import { useStore } from '@nanostores/solid'
import {
  $assistantOpen, $assistantSlug, $assistantContainerId, $assistantContext,
  type PageContext,
} from '../stores/assistant'
import AppAssistantPanel from '../components/apps/AppAssistantPanel'

export default function AppAssistantIsland(props: {
  containerId: string
  slug: string
  pageContext: PageContext
}) {
  onMount(() => {
    $assistantSlug.set(props.slug)
    $assistantContainerId.set(props.containerId)
    $assistantContext.set(props.pageContext)
  })

  const open = useStore($assistantOpen)

  return (
    <>
      <Show when={open()}>
        <div
          class="shrink-0 h-full"
          style={{
            width: "340px",
            "border-left": "1px solid var(--ui-border)",
            "background-color": "var(--ui-bg)",
          }}
        >
          <AppAssistantPanel />
        </div>
      </Show>
      <Show when={!open()}>
        <button
          onClick={() => $assistantOpen.set(true)}
          class="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105"
          style={{
            "background-color": "var(--ui-primary)",
            "box-shadow": "0 2px 12px rgba(212,164,74,0.3)",
          }}
          aria-label="Open AI Assistant"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ui-text-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </Show>
    </>
  )
}
