import { createSignal, Show, For, onMount } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function FileUpload(props: { label?: string; accept?: string; multiple?: boolean; maxSizeMB?: number; bind?: string; disabled?: boolean }) {
  const formData = useStore($formData)
  const [files, setFiles] = createSignal<{ name: string; size: string; s3Key?: string }[]>([])
  const [dragOver, setDragOver] = createSignal(false)
  const [error, setError] = createSignal('')
  const [uploading, setUploading] = createSignal(false)
  let inputRef!: HTMLInputElement

  const maxBytes = () => (props.maxSizeMB ?? 10) * 1024 * 1024

  // Seed from existing formData bind value
  onMount(() => {
    if (props.bind) {
      const existing = formData()[props.bind]
      if (existing) {
        try {
          const parsed = JSON.parse(existing)
          if (Array.isArray(parsed)) setFiles(parsed)
          else if (parsed.s3Key) setFiles([parsed])
        } catch {
          if (existing) setFiles([{ name: existing, size: '', s3Key: existing }])
        }
      }
    }
  })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const uploadToS3 = async (file: File): Promise<{ s3Key: string; originalFilename: string } | null> => {
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/v1/upload', { method: 'POST', body: fd })
      if (res.ok) return res.json()
      return null
    } catch { return null }
  }

  const updateBindValue = (fileList: { name: string; size: string; s3Key?: string }[]) => {
    if (!props.bind) return
    if (fileList.length === 0) $formData.setKey(props.bind, '')
    else if (fileList.length === 1) $formData.setKey(props.bind, JSON.stringify({ s3Key: fileList[0].s3Key, name: fileList[0].name }))
    else $formData.setKey(props.bind, JSON.stringify(fileList.map(f => ({ s3Key: f.s3Key, name: f.name }))))
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || props.disabled) return
    setError('')
    const arr = Array.from(fileList)
    const oversized = arr.find(f => f.size > maxBytes())
    if (oversized) {
      setError(`"${oversized.name}" exceeds ${props.maxSizeMB ?? 10}MB limit`)
      return
    }

    setUploading(true)
    const uploaded: { name: string; size: string; s3Key?: string }[] = []
    for (const file of arr) {
      const result = await uploadToS3(file)
      if (result) {
        uploaded.push({ name: file.name, size: formatSize(file.size), s3Key: result.s3Key })
      } else {
        uploaded.push({ name: file.name, size: formatSize(file.size) })
        setError(`Failed to upload "${file.name}"`)
      }
    }
    const newFiles = [...files(), ...uploaded]
    setFiles(newFiles)
    updateBindValue(newFiles)
    setUploading(false)
  }

  const removeFile = (idx: number) => {
    if (props.disabled) return
    const newFiles = files().filter((_, i) => i !== idx)
    setFiles(newFiles)
    updateBindValue(newFiles)
  }

  return (
    <div class="flex flex-col gap-2">
      <Show when={props.label}>
        <label class="text-sm font-medium" style={{ color: 'var(--ui-text-secondary)' }}>{props.label}</label>
      </Show>

      {/* Drop zone */}
      <div
        role="button"
        aria-label="Upload file"
        class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 transition-all duration-150"
        style={{
          "border-color": props.disabled ? 'var(--ui-border)' : dragOver() ? 'var(--ui-primary)' : 'var(--ui-border)',
          "background-color": props.disabled ? 'var(--ui-bg-muted)' : dragOver() ? 'color-mix(in srgb, var(--ui-primary) 5%, var(--ui-bg))' : 'var(--ui-bg-subtle)',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? '0.6' : '1',
        }}
        onDragOver={(e) => { e.preventDefault(); if (!props.disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer?.files ?? null) }}
        onClick={() => !props.disabled && inputRef.click()}
      >
        <Show when={uploading()} fallback={
          <>
            {/* Upload icon */}
            <svg viewBox="0 0 24 24" fill="none" style={{ width: '32px', height: '32px', color: 'var(--ui-text-muted)' }}>
              <path d="M12 16V4m0 0L8 8m4-4l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M20 16.7v1.3a2 2 0 01-2 2H6a2 2 0 01-2-2v-1.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <div class="text-center">
              <p class="text-sm font-medium" style={{ color: 'var(--ui-text)' }}>
                Drop files here or <span style={{ color: 'var(--ui-primary)' }}>browse</span>
              </p>
              <p class="text-xs mt-1" style={{ color: 'var(--ui-text-muted)' }}>
                {props.accept ? `Accepted: ${props.accept}` : 'Any file type'} · Max {props.maxSizeMB ?? 10}MB
              </p>
            </div>
          </>
        }>
          {/* Uploading spinner */}
          <svg class="animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: '32px', height: '32px', color: 'var(--ui-primary)' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25" />
            <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <p class="text-sm font-medium" style={{ color: 'var(--ui-text-muted)' }}>Uploading...</p>
        </Show>
        <input
          ref={inputRef}
          type="file"
          accept={props.accept}
          multiple={props.multiple ?? false}
          class="hidden"
          disabled={props.disabled}
          onChange={(e) => handleFiles(e.currentTarget.files)}
        />
      </div>

      {/* Error */}
      <Show when={error()}>
        <p class="text-xs" style={{ color: 'var(--ui-error)' }}>{error()}</p>
      </Show>

      {/* File list */}
      <Show when={files().length > 0}>
        <div class="flex flex-col gap-1.5">
          <For each={files()}>
            {(file, i) => (
              <div
                class="flex items-center gap-3 rounded-lg border px-3 py-2"
                style={{ "border-color": 'var(--ui-border)', "background-color": 'var(--ui-bg)' }}
              >
                {/* File icon */}
                <svg viewBox="0 0 20 20" fill="none" style={{ width: '16px', height: '16px', color: 'var(--ui-text-muted)', "flex-shrink": '0' }}>
                  <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" />
                  <path d="M12 2v4h4" stroke="currentColor" stroke-width="1.5" />
                </svg>
                <span class="flex-1 text-sm truncate" style={{ color: 'var(--ui-text)' }}>{file.name}</span>
                <span class="text-xs" style={{ color: 'var(--ui-text-muted)' }}>{file.size}</span>
                <button
                  type="button"
                  class="flex items-center justify-center rounded-md cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ width: '20px', height: '20px', color: 'var(--ui-text-muted)' }}
                  onClick={(e) => { e.stopPropagation(); removeFile(i()) }}
                >
                  <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
