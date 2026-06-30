// Shimmer skeletons shown while data loads.

export function SkeletonLine({ w = '100%', h = 12, style }) {
  return <div className="skeleton sk-line" style={{ width: w, height: h, ...style }} />;
}

export function SkeletonStatCards({ count = 4 }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i}>
          <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SkeletonLine w="60%" h={10} />
            <SkeletonLine w="40%" h={18} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton table rows. `cols` describes each column: { user } renders an
// avatar+lines cell; anything else renders a plain line.
export function SkeletonTable({ rows = 6, cols = 5, withUser = true }) {
  return (
    <div className="table-scroll">
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  {withUser && c === 0 ? (
                    <div className="sk-cell">
                      <div className="skeleton sk-circle" />
                      <div style={{ flex: 1 }}>
                        <SkeletonLine w="70%" h={11} />
                        <SkeletonLine w="45%" h={9} />
                      </div>
                    </div>
                  ) : (
                    <SkeletonLine w={`${50 + ((r + c) % 4) * 12}%`} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
