import { createClient } from '@/lib/supabase/server'
import { formatUGX } from '@/lib/types'
import DashboardChart from './DashboardChart'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role, businesses(name, plan)')
    .eq('user_id', user!.id)
    .single()

  const businessId = employee?.business_id as string
  const business = employee?.businesses as unknown as { name: string; plan: string } | null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  // Month start (30 days ago)
  const monthStart = new Date()
  monthStart.setDate(monthStart.getDate() - 29)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartStr = monthStart.toISOString()

  // Today's revenue: invoices issued today
  const { data: todayInvoices } = await supabase
    .from('invoices')
    .select('total_amount, amount_paid')
    .eq('business_id', businessId)
    .gte('issue_date', today.toISOString().split('T')[0])
    .neq('status', 'void')

  const todayRevenue = todayInvoices?.reduce((s, i) => s + Number(i.total_amount), 0) ?? 0

  // Cash collected this month: invoice_payments in last 30 days
  const { data: monthPayments } = await supabase
    .from('invoice_payments')
    .select('amount, payment_date')
    .eq('business_id', businessId)
    .gte('payment_date', monthStart.toISOString().split('T')[0])

  const cashCollected = monthPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0

  // Outstanding: unpaid invoices (open + partial)
  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('total_amount, amount_paid')
    .eq('business_id', businessId)
    .in('status', ['open', 'partial'])

  const outstanding = openInvoices?.reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0) ?? 0

  // Overdue bills count
  const todayDateStr = new Date().toISOString().split('T')[0]
  const { count: overdueBillsCount } = await supabase
    .from('purchase_bills')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .in('status', ['open', 'partial'])
    .lt('due_date', todayDateStr)

  // Overdue invoices
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('total_amount, amount_paid')
    .eq('business_id', businessId)
    .eq('status', 'open')
    .lt('due_date', todayDateStr)

  const overdueInvoiceCount = overdueInvoices?.length ?? 0
  const overdueInvoiceTotal = overdueInvoices?.reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0) ?? 0

  // Overdue vendor bills total
  const { data: overdueBills } = await supabase
    .from('purchase_bills')
    .select('total_amount, amount_paid')
    .eq('business_id', businessId)
    .in('status', ['open', 'partial'])
    .lt('due_date', todayDateStr)

  const overdueBillTotal = overdueBills?.reduce((s, b) => s + (Number(b.total_amount) - Number(b.amount_paid)), 0) ?? 0

  // Low stock
  const { data: lowStockProducts } = await supabase
    .from('products')
    .select('name, stock_qty, low_stock_threshold')
    .eq('business_id', businessId)
    .eq('is_active', true)

  const lowStockItems = lowStockProducts?.filter(p => p.stock_qty <= p.low_stock_threshold) ?? []

  // 30-day cash flow chart data (payments grouped by date)
  const chartData: { label: string; collected: number }[] = []
  const paymentMap: Record<string, number> = {}
  monthPayments?.forEach(p => {
    const d = p.payment_date
    paymentMap[d] = (paymentMap[d] ?? 0) + Number(p.amount)
  })

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
    chartData.push({ label, collected: paymentMap[key] ?? 0 })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{business?.name ?? 'Dashboard'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Revenue" value={formatUGX(todayRevenue)} color="emerald" />
        <StatCard label="Cash Collected (30d)" value={formatUGX(cashCollected)} color="blue" />
        <StatCard label="Outstanding Receivables" value={formatUGX(outstanding)} color="orange" />
        <StatCard label="Overdue Bills" value={String(overdueBillsCount ?? 0)} color="red" suffix="bills" />
      </div>

      {/* 30-day cash flow chart */}
      <DashboardChart data={chartData} />

      {/* Widgets row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* Overdue invoices */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Overdue Invoices</p>
          {overdueInvoiceCount === 0 ? (
            <p className="text-sm text-slate-400">No overdue invoices</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-600">{overdueInvoiceCount}</p>
              <p className="text-sm text-slate-500 mt-1">Total: {formatUGX(overdueInvoiceTotal)}</p>
            </>
          )}
        </div>

        {/* Overdue bills */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Overdue Vendor Bills</p>
          {(overdueBillsCount ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No overdue bills</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-600">{overdueBillsCount ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">Total: {formatUGX(overdueBillTotal)}</p>
            </>
          )}
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Low Stock Alerts</p>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-slate-400">All products well-stocked</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {lowStockItems.slice(0, 5).map(p => (
                <div key={p.name} className="flex justify-between text-sm">
                  <span className="text-slate-700 truncate">{p.name}</span>
                  <span className="text-red-600 font-medium ml-2">{p.stock_qty} left</span>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <p className="text-xs text-slate-400 mt-1">+{lowStockItems.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}{suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}</p>
    </div>
  )
}
