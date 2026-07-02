import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-28 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted mb-6">Error 404</p>
      <h1 className="text-3xl font-bold text-foreground mb-4 leading-tight">Page not found</h1>
      <p className="text-muted mb-10">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Button href="/">Back to home</Button>
    </div>
  )
}
