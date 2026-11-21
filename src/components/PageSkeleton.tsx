/** Placeholder shown only in the instant-navigation shell; real pages are fully prerendered. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-64 rounded bg-slate-200" />
      <div className="mt-5 h-9 w-2/3 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-full max-w-2xl rounded bg-slate-200" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
