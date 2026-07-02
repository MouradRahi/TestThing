// Skeleton shown while the shop catalog streams in (RSC data fetch)
export default function ShopLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="h-7 w-32 bg-surface rounded animate-pulse mb-8" />
      <div className="h-10 w-full max-w-sm bg-surface rounded animate-pulse mb-10" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-surface rounded-sm" />
            <div className="h-3 w-2/3 bg-surface rounded mt-3" />
            <div className="h-3 w-1/3 bg-surface rounded mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
