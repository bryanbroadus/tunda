import { createClient } from '@/lib/supabase/server'
import { formatUGX } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role, businesses(name, plan)')
    .eq('user_id', user!.id)
    .single()

  const businessId = employee?.business_id
  const business = employee?.businesses as { name: string; plan: string } | null

  // Fetch today's summary
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todaySales } = await supabase
    .from('sales')
    .select('total_amount, payment_type')
    .eq('business_id', businessId)
    .gte('created_at', today.toISOString())

  const totalRevenue = todaySales?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0
  const cashSales = todaySales?.filter(s => s.payment_type === 'cash').reduce((s, r) => s + Number(r.total_amount), 0) ?? 0
  const creditSales = todaySales?.filter(s => s.payment_type === 'credit').reduce((s, r) => s + Number(r.total_amount), 0) ?? 0

  const { count: lowStockCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)
    .filter('stock_qty', 'lte', 'low_stock_threshold')

  const { data: outstandingCredit } = await supabase
    .from('customers')
    .select('credit_balance')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gt('credit_balance', 0)

  const totalCredit = outstandingCredit?.reduce((s, c) => s + Number(c.credit_balance), 0) ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {business?.name ?? 'Dashboard'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Today — {new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Today's Revenue" value={formatUGX(totalRevenue)} color="emerald" />
        <StatCard label="Cash Sales" value={formatUGX(cashSales)} color="blue" />
        <StatCard label="Credit Sales" value={formatUGX(creditSales)} color="orange" />
        <StatCard label="Outstanding Credit" value={formatUGX(totalCredit)} color="red" />
      </div>

      {(lowStockCount ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-amber-600 text-xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-800">{lowStockCount} product{lowStockCount === 1 ? '' : 's'} low on stock</p>
            <p className="text-sm text-amber-600">Check your inventory and restock soon.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
