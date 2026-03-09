import { For } from 'solid-js'

export function Table(props: { columns: string[]; rows: string[][] }) {
  return (
    <div class="overflow-auto rounded-lg border" style={{ "border-color": "var(--ui-border)" }}>
      <table class="w-full text-sm" style={{ color: "var(--ui-text)" }}>
        <thead>
          <tr style={{ "background-color": "var(--ui-bg-muted)" }}>
            <For each={props.columns}>{(col) => <th class="px-4 py-2 text-left font-medium" style={{ color: "var(--ui-text-secondary)" }}>{col}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>{(row) => (
            <tr class="border-t" style={{ "border-color": "var(--ui-border)" }}>
              <For each={row}>{(cell) => <td class="px-4 py-2">{cell}</td>}</For>
            </tr>
          )}</For>
        </tbody>
      </table>
    </div>
  )
}
