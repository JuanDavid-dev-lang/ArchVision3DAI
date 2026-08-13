/** Esqueleto de carga del area autenticada. */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="h-6 w-48 animate-pulse rounded bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-panel bg-surface-2" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-panel bg-surface-2" />
    </div>
  );
}
