'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  business: { id: string; name: string; plan: string }
  role: 'owner' | 'employee'
}

const ownerNav = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/pos', label: 'Point of Sale', icon: '🛒' },
  { href: '/dashboard/products', label: 'Inventory', icon: '📦' },
  { href: '/dashboard/customers', label: 'Customers', icon: '👥' },
  { href: '/dashboard/accounting', label: 'Accounting', icon: '💰' },
  { href: '/dashboard/reminders', label: 'SMS Reminders', icon: '📱' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

const employeeNav = [
  { href: '/dashboard/pos', label: 'Point of Sale', icon: '🛒' },
  { href: '/dashboard/products', label: 'Inventory', icon: '📦' },
  { href: '/dashboard/customers', label: 'Customers', icon: '👥' },
]

export default function Sidebar({ business, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = role === 'owner' ? ownerNav : employeeNav

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
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
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
