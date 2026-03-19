'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatUGX } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type Period = 'day' | 'week' | 'month'
type AccTab = 'overview' | 'transactions' | 'accounts'

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

interface LedgerEntry {
  id: string
  date: string
  description: string
  account: string
  type: 'credit' | 'debit'
  amount: number
  source: 'invoice_payment' | 'bill_payment' | 'bank_transaction'
}

interface AccountBalance {
  id: string
  name: string
  account_type: string
  current_balance: number
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

export default function AccountingClient({ businessId }: Props) {
  const [activeTab, setActiveTab] = useState<AccTab>('overview')
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<SummaryData | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [accounts, setAccounts] = useState<AccountBalance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getPeriodRange(period)
    const startStr = dateStr(start)
    const endStr = dateStr(end)

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total_amount, issue_date')
      .eq('business_id', businessId)
      .neq('status', 'void')
      .gte('issue_date', startStr)
      .lte('issue_date', endStr)

    const revenue = invoices?.reduce((s, i) => s + Number(i.total_amount), 0) ?? 0

    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('amount, payment_date')
      .eq('business_id', businessId)
      .gte('payment_date', startStr)
      .lte('payment_date', endStr)

    const cashCollected = payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0

    const invoiceIds = invoices?.map(i => i.id) ?? []
    let cogs = 0
    if (invoiceIds.length > 0) {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('qty, unit_cost')
        .in('invoice_id', invoiceIds)
      cogs = items?.reduce((s, i) => s + i.qty * i.unit_cost, 0) ?? 0
    }

    const { data: openInvoices } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid')
      .eq('business_id', businessId)
      .in('status', ['open', 'partial'])

    const outstandingReceivables = openInvoices?.reduce(
      (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0
    ) ?? 0

    const { data: openBills } = await supabase
      .from('purchase_bills')
      .select('total_amount, amount_paid')
      .eq('business_id', businessId)
      .in('status', ['open', 'partial'])

    const outstandingPayables = openBills?.reduce(
      (s, b) => s + (Number(b.total_amount) - Number(b.amount_paid)), 0
    ) ?? 0

    const chartMap: Record<string, number> = {}
    payments?.forEach(p => {
      chartMap[p.payment_date] = (chartMap[p.payment_date] ?? 0) + Number(p.amount)
    })

    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
    const chartData: { label: string; collected: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = dateStr(d)
      const label = d.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
      chartData.push({ label, collected: chartMap[key] ?? 0 })
    }

    setData({ revenue, cashCollected, cogs, grossProfit: cashCollected - cogs, outstandingReceivables, outstandingPayables, chartData })
    setLoading(false)
  }, [businessId, period])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Invoice payments (money IN)
    const { data: invPayments } = await supabase
      .from('invoice_payments')
      .select('id, amount, payment_date, payment_method, note, bank_accounts(name), invoices(invoice_number, customers(name))')
      .eq('business_id', businessId)
      .order('payment_date', { ascending: false })
      .limit(200)

    // Bill payments (money OUT)
    const { data: billPayments } = await supabase
      .from('purchase_bill_payments')
      .select('id, amount, payment_date, note, bank_accounts(name), purchase_bills(bill_number, vendors(name))')
      .eq('business_id', businessId)
      .order('payment_date', { ascending: false })
      .limit(200)

    // Bank transactions (internal)
    const { data: bankTxns } = await supabase
      .from('bank_transactions')
      .select('id, amount, type, description, transaction_date, bank_accounts(name)')
      .eq('business_id', businessId)
      .order('transaction_date', { ascending: false })
      .limit(200)

    const entries: LedgerEntry[] = []

    invPayments?.forEach(p => {
      const inv = p.invoices as unknown as { invoice_number: string; customers: { name: string } | null } | null
      const acc = p.bank_accounts as unknown as { name: string } | null
      entries.push({
        id: p.id,
        date: p.payment_date,
        description: `Payment for ${inv?.invoice_number ?? '—'}${inv?.customers ? ` (${inv.customers.name})` : ' — Cash Sale'}`,
        account: acc?.name ?? p.payment_method ?? 'Cash',
        type: 'credit',
        amount: Number(p.amount),
        source: 'invoice_payment',
      })
    })

    billPayments?.forEach(p => {
      const bill = p.purchase_bills as unknown as { bill_number: string; vendors: { name: string } | null } | null
      const acc = p.bank_accounts as unknown as { name: string } | null
      entries.push({
        id: p.id,
        date: p.payment_date,
        description: `Bill payment ${bill?.bill_number ?? '—'}${bill?.vendors ? ` to ${bill.vendors.name}` : ''}`,
        account: acc?.name ?? 'Cash',
        type: 'debit',
        amount: Number(p.amount),
        source: 'bill_payment',
      })
    })

    bankTxns?.forEach(t => {
      const acc = t.bank_accounts as unknown as { name: string } | null
      entries.push({
        id: t.id,
        date: t.transaction_date,
        description: t.description ?? (t.type === 'deposit' ? 'Deposit' : t.type === 'withdrawal' ? 'Withdrawal' : 'Transfer'),
        account: acc?.name ?? '—',
        type: t.type === 'deposit' ? 'credit' : 'debit',
        amount: Number(t.amount),
        source: 'bank_transaction',
      })
    })

    entries.sort((a, b) => b.date.localeCompare(a.date))
    setLedger(entries)
    setLoading(false)
  }, [businessId])

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('id, name, account_type, current_balance')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('account_type')

    setAccounts(bankAccounts?.map(a => ({
      id: a.id,
      name: a.name,
      account_type: a.account_type,
      current_balance: Number(a.current_balance),
    })) ?? [])
    setLoading(false)
  }, [businessId])

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview()
    else if (activeTab === 'transactions') fetchTransactions()
    else if (activeTab === 'accounts') fetchAccounts()
  }, [activeTab, fetchOverview, fetchTransactions, fetchAccounts])

  const tabs: { key: AccTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'accounts', label: 'Chart of Accounts' },
  ]

  const accountTypeLabel: Record<string, string> = {
    cash_drawer: 'Cash Drawer',
    cash: 'Cash',
    checking: 'Checking',
    savings: 'Savings',
    mobile_money: 'Mobile Money',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
        {activeTab === 'overview' && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && data && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard label="Revenue (Billed)" value={formatUGX(data.revenue)} color="emerald" />
                <StatCard label="Cash Collected" value={formatUGX(data.cashCollected)} color="blue" />
                <StatCard label="Cost of Goods (COGS)" value={formatUGX(data.cogs)} color="slate" />
                <StatCard label="Gross Profit" value={formatUGX(data.grossProfit)} color={data.grossProfit >= 0 ? 'emerald' : 'red'} />
                <StatCard label="Outstanding Receivables" value={formatUGX(data.outstandingReceivables)} color="orange" />
                <StatCard label="Outstanding Payables" value={formatUGX(data.outstandingPayables)} color="red" />
              </div>
              {data.chartData.some(d => d.collected > 0) && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
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

          {/* ── TRANSACTIONS ── */}
          {activeTab === 'transactions' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {ledger.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-3xl mb-3">📒</p>
                  <p>No transactions recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Description</th>
                        <th className="text-left px-4 py-3">Account</th>
                        <th className="text-left px-4 py-3">Type</th>
                        <th className="text-right px-4 py-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map(entry => (
                        <tr key={`${entry.source}-${entry.id}`} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{entry.description}</td>
                          <td className="px-4 py-3 text-slate-600">{entry.account}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                              entry.type === 'credit'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {entry.type === 'credit' ? '▲ IN' : '▼ OUT'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            entry.type === 'credit' ? 'text-emerald-700' : 'text-red-600'
                          }`}>
                            {entry.type === 'debit' ? '−' : '+'}{formatUGX(entry.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── CHART OF ACCOUNTS ── */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <p className="text-3xl mb-3">🏦</p>
                  <p>No accounts set up yet. Go to Settings → Accounts.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
                    {accounts.map(acc => (
                      <div key={acc.id} className="bg-white rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                          {accountTypeLabel[acc.account_type] ?? acc.account_type}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 mb-2">{acc.name}</p>
                        <p className={`text-xl font-bold ${acc.current_balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatUGX(acc.current_balance)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Total Across All Accounts</span>
                    <span className="text-xl font-bold text-slate-900">
                      {formatUGX(accounts.reduce((s, a) => s + a.current_balance, 0))}
                    </span>
                  </div>
                </>
              )}
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
