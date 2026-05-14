export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-64 bg-secondary/60 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 overflow-hidden">
            <div className="aspect-[16/10] bg-secondary/40 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-2/3 bg-secondary/60 rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-secondary/40 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
