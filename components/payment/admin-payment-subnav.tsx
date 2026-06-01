'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin/payment', label: 'Overview' },
  { href: '/admin/payment/sellers', label: 'Urubuto sellers' },
  { href: '/admin/payment/seller-checkout', label: 'Seller checkout (BUY…)' },
] as const;

export function AdminPaymentSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 mb-6" aria-label="Payment admin sections">
      {links.map((link) => {
        const active =
          link.href === '/admin/payment'
            ? pathname === '/admin/payment'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
