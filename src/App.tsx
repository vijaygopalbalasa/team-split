import { useState } from 'react'
import WalletBar from './components/WalletBar'
import NewSplitForm from './components/NewSplitForm'
import SplitList from './components/SplitList'
import SplitPage from './components/SplitPage'

type View =
  | { type: 'home' }
  | { type: 'split'; id: bigint }

export default function App() {
  const [view, setView] = useState<View>({ type: 'home' })
  const [showForm, setShowForm] = useState(false)

  function handleCreated(splitId: bigint) {
    setShowForm(false)
    setView({ type: 'split', id: splitId })
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <WalletBar />

      <main className="mx-auto max-w-lg px-4 py-6">
        {view.type === 'split' ? (
          <SplitPage
            splitId={view.id}
            onBack={() => setView({ type: 'home' })}
          />
        ) : (
          <div className="space-y-5">
            {/* Hero */}
            <div className="pt-2">
              <h1 className="display text-3xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                Team Split
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                USDC revenue splits on Arc. Create once, withdraw anytime.
              </p>
            </div>

            {/* New split toggle */}
            <button
              onClick={() => setShowForm(v => !v)}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'var(--accent)' }}
            >
              {showForm ? 'Cancel' : '+ New split'}
            </button>

            {showForm && <NewSplitForm onCreated={handleCreated} />}

            {/* Existing splits */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
                All splits
              </p>
              <SplitList onSelect={id => setView({ type: 'split', id })} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
