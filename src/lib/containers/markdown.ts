export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderMarkdown(text: string): string {
  return text
    .replace(/```json:entity_types\n[\s\S]*?```/g,
      '<div class="cm-meta-block"><span>Entity types summary — click "Save All to Manifest" to apply</span></div>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="cm-codeblock"><code>${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#### (.+)$/gm, '<h4 class="cm-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="cm-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="cm-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="cm-h1">$1</h1>')
    .replace(/^---$/gm, '<hr class="cm-hr"/>')
    .replace(/^- (.+)$/gm, '<li class="cm-li-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="cm-li-num">$1</li>')
    .replace(/\n\n/g, '</p><p class="cm-p">')
    .replace(/\n/g, '<br/>')
}

export function renderMarkdownSegment(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="cm-codeblock"><code>${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#### (.+)$/gm, '<h4 class="cm-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="cm-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="cm-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="cm-h1">$1</h1>')
    .replace(/^---$/gm, '<hr class="cm-hr"/>')
    .replace(/^- (.+)$/gm, '<li class="cm-li-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="cm-li-num">$1</li>')
    .replace(/\n\n/g, '</p><p class="cm-p">')
    .replace(/\n/g, '<br/>')
}
