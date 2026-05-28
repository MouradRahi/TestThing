export type CartItem = {
  id: string
  slug: string
  title: string
  price: number
  imageUrl?: string
  quantity: number
}

const CART_KEY = 'trackid-cart'

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CART_KEY, JSON.stringify(items))
}
