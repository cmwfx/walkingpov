import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
export const GIFT_CARD_LINK = 'https://www.g2a.com/rewarble-visa-gift-card-50-eur-by-rewarble-key-global-i10000502992084';
export const CONTACT_INFO = { email: 'hello@candidfan.com', reviewTime: 'within one business day' };

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes + ':' + String(remainder).padStart(2, '0');
}

