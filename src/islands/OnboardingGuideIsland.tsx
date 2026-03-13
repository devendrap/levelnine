import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';

interface Props {
  storageKey: string;
  title: string;
  description: string;
  steps: Array<{ title: string; description: string }>;
}

export default function OnboardingGuideIsland(props: Props) {
  const [visible, setVisible] = createSignal(false);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(props.storageKey, 'true');
    } catch {
      // localStorage may be unavailable
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') dismiss();
  }

  onMount(() => {
    try {
      if (!localStorage.getItem(props.storageKey)) {
        setVisible(true);
      }
    } catch {
      // localStorage may be unavailable
    }
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={visible()}>
      <div
        style={{
          position: 'fixed',
          inset: '0',
          'z-index': '50',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          background: 'rgba(0,0,0,0.4)',
          'backdrop-filter': 'blur(2px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismiss();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <div
          style={{
            'max-width': '640px',
            width: '100%',
            margin: '16px',
            background: 'var(--ui-card-bg)',
            'border-radius': 'var(--ui-radius-xl)',
            'box-shadow': 'var(--ui-shadow-lg)',
            overflow: 'hidden',
            animation: 'ui-fade-scale-in 0.2s ease-out',
          }}
        >
          {/* Top section */}
          <div style={{ padding: '32px' }}>
            <h2
              style={{
                'font-size': '24px',
                'font-weight': '700',
                color: 'var(--ui-text)',
                margin: '0 0 8px 0',
              }}
            >
              {props.title}
            </h2>
            <p
              style={{
                'font-size': '14px',
                color: 'var(--ui-text-muted)',
                margin: '0 0 24px 0',
                'line-height': '1.5',
              }}
            >
              {props.description}
            </p>
            <button class="ui-btn ui-btn-primary ui-btn-lg" onClick={dismiss}>
              Get Started
            </button>
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              'background-color': 'var(--ui-border)',
              width: '100%',
            }}
          />

          {/* Steps section */}
          <div style={{ padding: '24px 32px' }}>
            <div
              style={{
                'font-size': '10px',
                'font-weight': '600',
                'text-transform': 'uppercase',
                'letter-spacing': '0.08em',
                color: 'var(--ui-text-placeholder)',
                'text-align': 'center',
                'margin-bottom': '20px',
              }}
            >
              HOW IT WORKS
            </div>
            <div
              style={{
                display: 'flex',
                gap: '24px',
                'justify-content': 'center',
              }}
            >
              <For each={props.steps}>
                {(step, index) => (
                  <div
                    style={{
                      flex: '1',
                      display: 'flex',
                      'flex-direction': 'column',
                      'align-items': 'start',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        'border-radius': 'var(--ui-radius-sm)',
                        background: 'var(--ui-primary-light)',
                        color: 'var(--ui-primary)',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'font-size': '12px',
                        'font-weight': '600',
                        'margin-bottom': '10px',
                      }}
                    >
                      {index() + 1}
                    </div>
                    <div
                      style={{
                        'font-size': '13px',
                        'font-weight': '500',
                        color: 'var(--ui-text)',
                        'margin-bottom': '4px',
                      }}
                    >
                      {step.title}
                    </div>
                    <div
                      style={{
                        'font-size': '12px',
                        color: 'var(--ui-text-muted)',
                        'line-height': '1.4',
                      }}
                    >
                      {step.description}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
