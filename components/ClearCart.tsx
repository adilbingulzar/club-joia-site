'use client';
import { useEffect } from 'react';
import { Cart } from '@/lib/cart';

export default function ClearCart() {
  useEffect(function () { Cart.clear(); }, []);
  return null;
}
