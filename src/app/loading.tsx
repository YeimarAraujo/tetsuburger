export default function Loading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true">
      <span className="sr-only">Cargando el menú…</span>

      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-48 animate-pulse rounded-2xl bg-muted sm:h-64" />

        <div className="mt-8 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-muted"
            />
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex gap-4 rounded-xl border p-4"
            >
              <div className="size-28 shrink-0 animate-pulse rounded-xl bg-muted sm:size-36" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="mt-6 h-9 w-28 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
