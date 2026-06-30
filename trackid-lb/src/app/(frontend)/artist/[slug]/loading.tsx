// Skeleton for the artist profile page while data resolves
export default function ArtistLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row gap-8 items-start mb-12 animate-pulse">
        <div className="w-40 h-40 bg-surface rounded-full shrink-0" />
        <div className="space-y-3 flex-1">
          <div className="h-8 w-1/2 bg-surface rounded" />
          <div className="h-4 w-24 bg-surface rounded" />
          <div className="h-3 w-full bg-surface rounded mt-4" />
          <div className="h-3 w-4/5 bg-surface rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-surface rounded-sm" />
            <div className="h-3 w-2/3 bg-surface rounded mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
