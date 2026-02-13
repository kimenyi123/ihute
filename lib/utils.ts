import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * B2B Utility Functions
 * Task 8.4 - Requirements 18.2, 19.2, 20.2
 */

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = "RWF"): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format date (short version - date only)
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format order status for display
 */
export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'B2B_DRAFT': 'Draft',
    'B2B_SUBMITTED': 'Submitted',
    'B2B_NEEDS_CHANGES': 'Needs Changes',
    'B2B_CHANGES_ACCEPTED': 'Changes Accepted',
    'B2B_ACCEPTED': 'Accepted',
    'B2B_REJECTED': 'Rejected',
    'B2B_CONFIRMED': 'Confirmed',
  };
  
  return statusMap[status] || status;
}

/**
 * Get status color class for Tailwind
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'B2B_DRAFT': 'bg-gray-100 text-gray-800',
    'B2B_SUBMITTED': 'bg-blue-100 text-blue-800',
    'B2B_NEEDS_CHANGES': 'bg-yellow-100 text-yellow-800',
    'B2B_CHANGES_ACCEPTED': 'bg-green-100 text-green-800',
    'B2B_ACCEPTED': 'bg-green-100 text-green-800',
    'B2B_REJECTED': 'bg-red-100 text-red-800',
    'B2B_CONFIRMED': 'bg-purple-100 text-purple-800',
  };
  
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Format negotiation status
 */
export function formatNegotiationStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'OPEN': 'Open',
    'AGREED': 'Agreed',
    'REJECTED': 'Rejected',
    'EXPIRED': 'Expired',
  };
  
  return statusMap[status] || status;
}

/**
 * Get negotiation status color
 */
export function getNegotiationStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'OPEN': 'bg-blue-100 text-blue-800',
    'AGREED': 'bg-green-100 text-green-800',
    'REJECTED': 'bg-red-100 text-red-800',
    'EXPIRED': 'bg-gray-100 text-gray-800',
  };
  
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}
