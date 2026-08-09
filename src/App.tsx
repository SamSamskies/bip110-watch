import { useMemo, useState } from 'react'
import './index.css'
import { useForkMonitor } from './hooks/useForkMonitor'
import { ForkTopology } from './components/ForkTopology'
import { TopologySkeleton } from './components/TopologySkeleton'
import { BlockDetails } from './components/BlockDetails'
import type { TopologyBlock } from './lib/types'

function App() {
  const monitor = useForkMonitor()
  const [selectedHash, setSelectedHash] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (!monitor.topology || !selectedHash) return null
    const all: TopologyBlock[] = [
      ...monitor.topology.shared,
      ...monitor.topology.coreBranch,
      ...monitor.topology.knotsBranch,
    ]
    return all.find((b) => b.hash === selectedHash) ?? null
  }, [monitor.topology, selectedHash])

  return (
    <div className="app">
      <header className="app-brand">
        <div>
          <h1>BIP-110 Watch</h1>
          <p>
            BIP-110 fork topology during mandatory signaling.
          </p>
        </div>
      </header>

      {monitor.loading && !monitor.topology ? (
        <TopologySkeleton />
      ) : monitor.topology ? (
        <div className={`main-row${selected ? ' has-details' : ''}`}>
          <ForkTopology
            topology={monitor.topology}
            selectedHash={selectedHash}
            onSelect={(b) => setSelectedHash(b.hash)}
          />
          {selected ? (
            <BlockDetails
              block={selected}
              onClose={() => setSelectedHash(null)}
            />
          ) : null}
        </div>
      ) : (
        <p className="loading">
          {monitor.error ?? 'No topology data yet.'}
        </p>
      )}

      <footer className="app-footer">
        <span>
          Data:{' '}
          <a href="https://bip110.orange.surf/live.html" target="_blank" rel="noreferrer">
            orange.surf
          </a>
          {' · '}
          <a href="https://fork.observer/?network=mainnet" target="_blank" rel="noreferrer">
            fork.observer
          </a>
          {monitor.esploraHost ? ` · Esplora ${monitor.esploraHost}` : ''}
        </span>
      </footer>
    </div>
  )
}

export default App
