import { For } from 'solid-js'

type ColumnDef = string | { key: string; header: string }

export function Table(props: {
  columns: ColumnDef[]
  rows?: (string | Record<string, any>)[][]
  bind?: string
  editable?: boolean
}) {
  const headers = () =>
    props.columns.map(c => typeof c === 'string' ? c : c.header)

  const keys = () =>
    props.columns.map(c => typeof c === 'string' ? c : c.key)

  const resolvedRows = () => {
    if (!props.rows || props.rows.length === 0) return []
    return props.rows.map(row => {
      if (Array.isArray(row)) return row.map(String)
      // row is an object — extract by column keys
      if (typeof row === 'object' && row !== null) {
        return keys().map(k => String((row as any)[k] ?? ''))
      }
      return keys().map(() => '')
    })
  }

  return (
    <div
      class="overflow-auto rounded-lg border"
      style={{ "border-color": "var(--ui-border)", "box-shadow": "var(--ui-shadow)" }}
    >
      <table class="w-full text-sm" style={{ color: "var(--ui-text)" }}>
        <thead>
          <tr style={{ "background-color": "var(--ui-bg-subtle)" }}>
            <For each={headers()}>
              {(col) => (
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)", "border-bottom": "1px solid var(--ui-border)" }}>
                  {col}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={resolvedRows()} fallback={
            <tr>
              <td
                class="px-4 py-6 text-center text-xs"
                style={{ color: "var(--ui-text-muted)" }}
                colSpan={headers().length}
              >
                {props.editable ? 'No entries yet — click to add rows' : 'No data'}
              </td>
            </tr>
          }>
            {(row) => (
              <tr style={{ "border-top": "1px solid var(--ui-border)" }}>
                <For each={row}>
                  {(cell, i) => (
                    <td
                      class="px-4 py-3"
                      style={{ "font-weight": i() === 0 ? "500" : "400" }}
                    >
                      {cell}
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}
