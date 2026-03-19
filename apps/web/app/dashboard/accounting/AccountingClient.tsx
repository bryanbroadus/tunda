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
  cashCollected: number
  cogs: number
  grossProfit: number
  outstandingReceivables: number
  outstandingPayables: number
  chartData: { label: string; collected: number }[]
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

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function AccountingClient({ businessId, plan }: Props) {
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getPeriodRange(period)
    const startStr = dateStr(start)
    const endStr = dateStr(end)

    // Revenue: billed amount on invoices issued in period
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total_amount, issue_date')
      .eq('business_id', businessId)
      .neq('status', 'void')
      .gte('issue_date', startStr)
      .lte('issue_date', endStr)

    const revenue = invoices?.reduce((s, i) => s + Number(i.total_amount), 0) ?? 0

    // Cash collected: payments received in period
    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('amount, payment_date')
      .eq('business_id', businessId)
      .gte('payment_date', startStr)
      .lte('payment_date', endStr)

    const cashCollected = payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0

    // COGS: sum of qty * unit_cost for invoice items in period invoices
    const invoiceIds = invoices?.map(i => i.id) ?? []
    let cogs = 0
    if (invoiceIds.length > 0) {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('qty, unit_cost')
        .in('invoice_id', invoiceIds)
      cogs = items?.reduce((s, i) => s + i.qty * i.unit_cost, 0) ?? 0
    }

    // Outstanding receivables: all unpaid invoices (open + partial)
    const { data: openInvoices } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid')
      .eq('business_id', businessId)
      .in('status', ['open', 'partial'])

    const outstandingReceivables = openInvoices?.reduce(
      (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0
    ) ?? 0

    // Outstanding payables: all unpaid purchase bills
    const { data: openBills } = await supabase
      .from('purchase_bills')
      .select('total_amount, amount_paid')
      .eq('business_id', businessId)
      .in('status', ['open', 'partial'])

    const outstandingPayables = openBills?.reduce(
      (s, b) => s + (Number(b.total_amount) - Number(b.amount_paid)), 0
    ) ?? 0

    // Chart: group payments by payment_date
    const chartMap: Record<string, number> = {}
    payments?.forEach(p => {
      chartMap[p.payment_date] = (chartMap[p.payment_date] ?? 0) + Number(p.amount)
    })

    // Build ordered chart data for the period
    const chartData: { label: string; collected: number }[] = []
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = dateStr(d)
      const label = d.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
      chartData.push({ label, collected: chartMap[key] ?? 0 })
    }

    setData({
      revenue,
      cashCollected,
      cogs,
      grossProfit: cashCollected - cogs,
      outstandingReceivables,
      outstandingPayables,
      chartData,
    })
    setLoading(false)
  }, [businessId, period])

  useEffect(() => { fetchData() }, [fetchData])

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
          {/* Period summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Revenue (Billed)" value={formatUGX(data.revenue)} color="emerald" />
            <StatCard label="Cash Collected" value={formatUGX(data.cashCollected)} color="blue" />
            <StatCard label="Cost of Goods (COGS)" value={formatUGX(data.cogs)} color="slate" />
            <StatCard label="Gross Profit" value={formatUGX(data.grossProfit)} color={data.grossProfit >= 0 ? 'emerald' : 'red'} />
            <StatCard label="Outstanding Receivables" value={formatUGX(data.outstandingReceivables)} color="orange" />
            <StatCard label="Outstanding Payables" value={formatUGX(data.outstandingPayables)} color="red" />
          </div>

          {/* Cash collected chart */}
          {data.chartData.some(d => d.collected > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <p className="text-sm font-medium text-slate-700 mb-4">Cash Collected by Day</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatUGX(Number(v))} />
                  <Bar dataKey="collected" fill="#059669" radius={[4, 4, 0, 0]} name="Cash Collected" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
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
