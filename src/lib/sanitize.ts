import DOMPurify from 'dompurify'

export function clean(html: string): string {
  return DOMPurify.sanitize(html)
}
