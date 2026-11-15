import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Join class names and let the later Tailwind class win (the helper shadcn components expect). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
