/** Placeholder topology card shown before the first DAG arrives. */
export function TopologySkeleton() {
  return (
    <section
      className="topology-card topology-skeleton"
      aria-label="Loading fork topology"
      aria-busy="true"
    >
      <header className="topology-header">
        <div className="topology-titles">
          <p className="eyebrow">Active chains</p>
          <h1>Fork topology</h1>
        </div>
        <p className="topology-status skeleton-line skeleton-line--status" />
        <div className="delta-badge delta-badge--muted skeleton-badge" />
      </header>

      <div className="topology-canvas skeleton-canvas" aria-hidden>
        <div className="skeleton-lane skeleton-lane--shared">
          <span className="skeleton-block" />
        </div>
        <div className="skeleton-fork">
          <div className="skeleton-lane">
            <span className="skeleton-block" />
            <span className="skeleton-block" />
            <span className="skeleton-block skeleton-block--ghost" />
            <span className="skeleton-block" />
            <span className="skeleton-label" />
          </div>
          <div className="skeleton-lane">
            <span className="skeleton-block" />
            <span className="skeleton-block skeleton-block--ghost" />
            <span className="skeleton-label" />
          </div>
        </div>
      </div>

      <p className="skeleton-caption">Loading tip monitors…</p>
    </section>
  );
}
