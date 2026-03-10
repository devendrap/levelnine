import { For } from 'solid-js'

export function Table(props: { columns: string[]; rows: string[][] }) {
  return (
    <div
      class="overflow-auto rounded-lg border"
      style={{ "border-color": "var(--ui-border)", "box-shadow": "var(--ui-shadow)" }}
    >
      <table class="w-full text-sm" style={{ color: "var(--ui-text)" }}>
        <thead>
          <tr style={{ "background-color": "var(--ui-bg-subtle)" }}>
            <For each={props.columns}>
              {(col) => (
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)", "border-bottom": "1px solid var(--ui-border)" }}>
                  {col}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
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
