import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const GIFT_CARD_LINK = 'https://www.g2a.com/rewarble-visa-gift-card-30-usd-by-rewarble-key-global-i10000502992007?redirect_from_oos_uuid=10df9f48-0732-40f0-b28e-83204e26a576';
export const CONTACT_INFO = {
  email: 'candidfancom@gmail.com',
  reviewTime: 'within 1 hour during business hours and within 8 hours outside business hours',
};

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
