import { createSignal, onMount, onCleanup } from 'solid-js'
import ConfirmDialog from './ConfirmDialog'
import Toast, { showToast } from './Toast'

export default function SidebarDeleteDialog() {
  const [open, setOpen] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [target, setTarget] = createSignal({ id: '', name: '' })

  function onRequest(e: Event) {
    const { id, name } = (e as CustomEvent).detail
    setTarget({ id, name })
    setOpen(true)
  }

  onMount(() => window.addEventListener('delete-container', onRequest))
  onCleanup(() => window.removeEventListener('delete-container', onRequest))

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/containers/${target().id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete container')
      setOpen(false)
      showToast('Container deleted successfully', 'success')
      setTimeout(() => { window.location.href = '/containers' }, 800)
    } catch (err: any) {
      showToast(err.message ?? 'Failed to delete container', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={open()}
        title="Delete Container"
        message={`Are you sure you want to delete "${target().name}"? This action cannot be undone.`}
        confirmLabel={loading() ? 'Deleting...' : 'Delete'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
      <Toast />
    </>
  )
}
