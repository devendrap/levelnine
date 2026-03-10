import { atom, map } from 'nanostores'

export const $theme = atom<'light' | 'dark'>('dark')
export const $formData = map<Record<string, string>>({})

export function resetFormData() {
  $formData.set({})
}

export function seedFormData(content: Record<string, any>) {
  const flat: Record<string, string> = {}
  for (const [key, val] of Object.entries(content ?? {})) {
    flat[key] = typeof val === 'string' ? val : JSON.stringify(val)
  }
  $formData.set(flat)
}

export const builtinActions: Record<string, () => void> = {
  toggleTheme: () => $theme.set($theme.get() === 'light' ? 'dark' : 'light'),
}

export function runAction(name: string) {
  builtinActions[name]?.()
}