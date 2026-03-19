'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatUGX } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type Period = 'day' | 'week' | 'month'

interface Props {
  businessId: string
  plan: string
}

interface SummaryData {
  revenue: number
  cogs: number
  profit: number
  cashOnHand: number
  totalBanked: number
  totalCredit: number
  chartData: { label: string; revenue: number }[]
}

function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  let start = new Date(now)
  if (period === 'day') {
    start.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(now.getDate() - 29)
    start.setHours(0, 0, 0, 0)
  }
  return { start, end }
}

export default function AccountingClient({ businessId, plan }: Props) {
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLogForm, setShowLogForm] = useState<'bank_deposit' | 'expense' | null>(null)
  const [logForm, setLogForm] = useState({ amount: '', note: '' })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getPeriodRange(period)

    // Sales + sale_items for revenue & COGS
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total_amount, payment_type, created_at')
      .eq('business_id', businessId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const saleIds = sales?.map(s => s.id) ?? []
    let cogsTotal = 0
    if (saleIds.length > 0) {
      const { data: items } = await supabase
        .from('sale_items')
        .select('qty, unit_cost')
        .in('sale_id', saleIds)
      cogsTotal = items?.reduce((s, i) => s + i.qty * i.unit_cost, 0) ?? 0
    }

    const revenue = sales?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0

    // Cash log
    const { data: cashLog } = await supabase
      .from('cash_log')
      .select('type, amount')
      .eq('business_id', businessId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const sumType = (type: string) =>
      cashLog?.filter(r => r.type === type).reduce((s, r) => s + Number(r.amount), 0) ?? 0

    const cashIn = sumType('sale')
    const banked = sumType('bank_deposit')
    const expenses = sumType('expense')
    const cashOnHand = cashIn - banked - expenses

    // Outstanding credit (all time)
    const { data: creditCustomers } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('business_id', businessId)
      .gt('credit_balance', 0)
    const totalCredit = creditCustomers?.reduce((s, c) => s + Number(c.credit_balance), 0) ?? 0

    // Chart: group sales by day
    const chartMap: Record<string, number> = {}
    sales?.forEach(s => {
      const day = new Date(s.created_at).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
      chartMap[day] = (chartMap[day] ?? 0) + Number(s.total_amount)
    })
    const chartData = Object.entries(chartMap)
      .map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime())

    setData({
      revenue,
      cogs: cogsTotal,
      profit: revenue - cogsTotal,
      cashOnHand,
      totalBanked: banked,
      totalCredit,
      chartData,
    })
    setLoading(false)
  }, [businessId, period])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleLogEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!showLogForm) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('cash_log').insert({
      business_id: businessId,
      type: showLogForm,
      amount: parseFloat(logForm.amount),
      note: logForm.note.trim() || null,
    })
    setShowLogForm(null)
    setLogForm({ amount: '', note: '' })
    setSaving(false)
    fetchData()
  }

  const isFullPlan = plan === 'business' || plan === 'shop_plus'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                period === p ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {p === 'day' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Revenue" value={formatUGX(data.revenue)} color="emerald" />
            <StatCard label="Cost of Goods (COGS)" value={formatUGX(data.cogs)} color="slate" />
            <StatCard label="Gross Profit" value={formatUGX(data.profit)} color={data.profit >= 0 ? 'emerald' : 'red'} />
            {isFullPlan ? (
              <>
                <StatCard label="Cash on Hand" value={formatUGX(data.cashOnHand)} color="blue" />
                <StatCard label="Total Banked" value={formatUGX(data.totalBanked)} color="blue" />
                <StatCard label="Outstanding Credit" value={formatUGX(data.totalCredit)} color="orange" />
              </>
            ) : (
              <div className="col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>Upgrade to Business plan</strong> to see Cash on Hand, Banked totals, and log expenses/deposits.
              </div>
            )}
          </div>

          {/* Chart */}
          {data.chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <p className="text-sm font-medium text-slate-700 mb-4">Sales Revenue</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatUGX(Number(v))} />
                  <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Log deposit / expense */}
          {isFullPlan && (
            <div className="flex gap-3">
              <button onClick={() => setShowLogForm('bank_deposit')}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
                + Log Bank Deposit
              </button>
              <button onClick={() => setShowLogForm('expense')}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                + Log Expense
              </button>
            </div>
          )}
        </>
      )}

      {showLogForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {showLogForm === 'bank_deposit' ? 'Log Bank Deposit' : 'Log Expense'}
              </h2>
              <button onClick={() => setShowLogForm(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleLogEntry} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount (UGX)</label>
                <input required type="number" min="1" value={logForm.amount}
                  onChange={e => setLogForm(f => ({ ...f, amount: e.target.value }))}
                  className="input" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                <input value={logForm.note} onChange={e => setLogForm(f => ({ ...f, note: e.target.value }))}
                  className="input" placeholder="Optional description" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-50 text-slate-700',
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
