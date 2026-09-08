import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const GIFT_CARD_LINK = 'https://www.g2a.com/rewarble-visa-gift-card-50-eur-by-rewarble-key-global-i10000502992084';
export const CONTACT_INFO = { reviewTime: 'within 24 hours' };

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
