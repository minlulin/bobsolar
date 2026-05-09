import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMMK(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${Math.round(value).toLocaleString('en-US')} MMK`;
}
