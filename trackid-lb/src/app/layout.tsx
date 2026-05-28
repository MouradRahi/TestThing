// Root layout: no HTML shell here — each route group provides its own.
// (payload) uses RootLayout from @payloadcms/next; (frontend) has its own layout.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
