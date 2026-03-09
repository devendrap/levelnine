import { atom, map } from 'nanostores'

export const $theme = atom<'light' | 'dark'>('light')
export const $formData = map<Record<string, string>>({})

export const builtinActions: Record<string, () => void> = {
  toggleTheme: () => $theme.set($theme.get() === 'light' ? 'dark' : 'light'),
}

export function runAction(name: string) {
  builtinActions[name]?.()
}

export function resolveBindings(text: string): string {
  return text.replace(/\$(\w+)/g, (_, key) => $formData.get()[key] ?? '')
}
