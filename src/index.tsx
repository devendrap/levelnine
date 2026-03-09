/* @refresh reload */
import { render } from 'solid-js/web'
import { Show } from 'solid-js'
import './index.css'
import { App } from './preview/App'
import { PreviewRoute } from './preview/PreviewRoute'

function Root() {
  const path = window.location.pathname
  const match = path.match(/^\/preview\/(.+)$/)

  return (
    <Show when={match} fallback={<App />}>
      <PreviewRoute id={match![1]} />
    </Show>
  )
}

const root = document.getElementById('root')
render(() => <Root />, root!)
