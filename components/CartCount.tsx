'use client';
import { useCart } from '@/lib/cart';

export default function CartCount() {
  const n = useCart().count;
  return <span className="cart-count" data-cart-count="">{n || ''}</span>;
}
