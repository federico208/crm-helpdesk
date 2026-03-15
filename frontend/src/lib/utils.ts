import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: it });
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: it });
}

export function formatDateShort(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy', { locale: it });
}

export function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}
