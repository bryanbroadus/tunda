'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  business: { id: string; name: string; plan: string }
  role: 'owner' | 'employee'
}

type NavItem = { href: string; label: string; icon: string }
type NavSection = { heading: string; items: NavItem[] }

const ownerSections: NavSection[] = [
  {
    heading: 'SALES',
    items: [
      { href: '/dashboard/sales/pos', label: 'Point of Sale', icon: '🛒' },
      { href: '/dashboard/sales/invoices', label: 'Invoices', icon: '🧾' },
      { href: '/dashboard/sales/products', label: 'Products', icon: '📦' },
      { href: '/dashboard/sales/customers', label: 'Customers', icon: '👥' },
    ],
  },
  {
    heading: 'PURCHASES',
    items: [
      { href: '/dashboard/purchases/vendors', label: 'Vendors', icon: '🏪' },
      { href: '/dashboard/purchases/bills', label: 'Bills', icon: '📄' },
    ],
  },
  {
    heading: 'FINANCE',
    items: [
      { href: '/dashboard/accounting', label: 'Accounting', icon: '💰' },
      { href: '/dashboard/banking', label: 'Banking', icon: '🏦' },
    ],
  },
  {
    heading: 'OTHER',
    items: [
      { href: '/dashboard/reminders', label: 'SMS Reminders', icon: '📱' },
      { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
]

const employeeSections: NavSection[] = [
  {
    heading: 'SALES',
    items: [
      { href: '/dashboard/sales/pos', label: 'Point of Sale', icon: '🛒' },
      { href: '/dashboard/sales/invoices', label: 'Invoices', icon: '🧾' },
      { href: '/dashboard/sales/products', label: 'Products', icon: '📦' },
      { href: '/dashboard/sales/customers', label: 'Customers', icon: '👥' },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function Sidebar({ business, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const sections = role === 'owner' ? ownerSections : employeeSections

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo / Business Name */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{business.name}</p>
            <p className="text-xs text-slate-400 capitalize">{business.plan} plan</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {/* Dashboard — always first */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
            isActive(pathname, '/dashboard')
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <span className="text-base">📊</span>
          Dashboard
        </Link>

        {sections.map(section => (
          <div key={section.heading}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pt-4 pb-1">
              {section.heading}
            </p>
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                  isActive(pathname, item.href)
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <span>🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
