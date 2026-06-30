// Skeleton for the product detail page while ISR/RSC data resolves
export default function ProductLoading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="aspect-square bg-surface rounded-sm animate-pulse" />
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-surface rounded" />
          <div className="h-8 w-3/4 bg-surface rounded" />
          <div className="h-6 w-20 bg-surface rounded" />
          <div className="h-px w-full bg-border my-6" />
          <div className="h-3 w-full bg-surface rounded" />
          <div className="h-3 w-5/6 bg-surface rounded" />
          <div className="h-3 w-4/6 bg-surface rounded" />
          <div className="h-12 w-full bg-surface rounded mt-8" />
        </div>
      </div>
    </div>
  )
}
