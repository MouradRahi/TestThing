'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

// Dependency-free toast (E4, ENHANCEMENTS.md) — aria-live polite, auto-dismiss,
// theme-colored (accent border/bg like CartNotices; differentiated by icon
// rather than a red/green color the design system doesn't define). Mounted
// once in the frontend layout; any client component calls useToast().

type ToastKind = 'success' | 'error'
type ToastEntry = { id: number; message: string; kind: ToastKind }

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 3500

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, kind }])
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 inset-x-4 z-[80] flex flex-col items-center gap-2 pointer-events-none sm:inset-x-auto sm:end-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-2 border border-accent/40 bg-surface px-4 py-2.5 text-xs text-foreground shadow-lg max-w-sm"
          >
            {toast.kind === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent shrink-0" aria-hidden="true">
                <path d="M2.5 7.5l3 3 6-6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground/70 shrink-0" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M7 4.5v3M7 9.5h.01" />
              </svg>
            )}
            <span className="leading-relaxed">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
