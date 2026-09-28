/**
 * Skeleton loaders — placeholders con la forma real del contenido (fila,
 * tarjeta, bloque) en vez de spinners o texto "Cargando...". Ver `.skeleton*`
 * en src/index.css.
 */

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <div className="skeleton skeleton-line" style={{ width }} />;
}

/** Filas de tabla: una <tr> por fila, con `columns` celdas rellenas de skeleton. */
export function SkeletonTableRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <SkeletonLine width={c === 0 ? "70%" : `${55 + ((r + c) % 3) * 12}%`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Lista de tarjetas apiladas (para vistas mobile o grids simples). */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card space-y-2">
          <SkeletonLine width="45%" />
          <SkeletonLine width="80%" />
          <SkeletonLine width="60%" />
        </div>
      ))}
    </>
  );
}

/** Página completa (fallback de Suspense entre rutas). */
export function SkeletonPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <SkeletonLine width="220px" />
      <div className="mt-2">
        <SkeletonLine width="340px" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="skeleton-card h-24" />
        <div className="skeleton-card h-24" />
        <div className="skeleton-card h-24" />
      </div>
      <div className="mt-6 skeleton-card space-y-3 p-5">
        <SkeletonLine width="100%" />
        <SkeletonLine width="92%" />
        <SkeletonLine width="96%" />
        <SkeletonLine width="70%" />
      </div>
    </div>
  );
}
