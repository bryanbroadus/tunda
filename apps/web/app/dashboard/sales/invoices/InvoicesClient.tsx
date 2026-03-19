'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type Invoice, type InvoiceStatus,
  formatUGX, invoiceStatusLabel, statusColor,
} from '@/lib/types'

type InvoiceWithCustomer = Invoice & {
  customers: { name: string; phone: string } | null
}

type FilterTab = 'all' | 'unpaid' | 'partial' | 'overdue' | 'paid'

interface Props {
  initialInvoices: InvoiceWithCustomer[]
  businessId: string
}

function isOverdue(invoice: Invoice): boolean {
  return invoice.status === 'open' && !!invoice.due_date && new Date(invoice.due_date) < new Date()
}

export default function InvoicesClient({ initialInvoices, businessId }: Props) {
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>(initialInvoices)
  const [tab, setTab] = useState<FilterTab>('all')
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceWithCustomer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'bank'>('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (tab === 'all') return inv.status !== 'void'
      if (tab === 'unpaid') return inv.status === 'open' && !isOverdue(inv)
      if (tab === 'partial') return inv.status === 'partial'
      if (tab === 'overdue') return isOverdue(inv)
      if (tab === 'paid') return inv.status === 'paid'
      return true
    })
  }, [invoices, tab])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'partial', label: 'Partial' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'paid', label: 'Paid' },
  ]

  function openPayment(invoice: InvoiceWithCustomer) {
    setPaymentInvoice(invoice)
    const balance = invoice.total_amount - invoice.amount_paid
    setPaymentAmount(String(balance))
    setPaymentNote('')
    setPaymentMethod('cash')
    setError('')
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentInvoice) return
    setSaving(true)
    setError('')

    const supabase = createClient()
    const amount = parseFloat(paymentAmount)
    const todayStr = new Date().toISOString().split('T')[0]

    const { error: payErr } = await supabase.from('invoice_payments').insert({
      invoice_id: paymentInvoice.id,
      business_id: businessId,
      amount,
      payment_date: todayStr,
      payment_method: paymentMethod,
      note: paymentNote.trim() || null,
    })

    if (payErr) { setError(payErr.message); setSaving(false); return }

    // Refresh the invoice from DB
    const { data: updated } = await supabase
      .from('invoices')
      .select('*, customers(name, phone)')
      .eq('id', paymentInvoice.id)
      .single()

    if (updated) {
      setInvoices(prev => prev.map(i => i.id === paymentInvoice.id ? updated as InvoiceWithCustomer : i))
    }

    // If customer had credit, reduce their balance
    if (paymentInvoice.customer_id && paymentInvoice.customers) {
      const { data: customer } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', paymentInvoice.customer_id)
        .single()

      if (customer && customer.credit_balance > 0) {
        await supabase
          .from('customers')
          .update({ credit_balance: Math.max(0, customer.credit_balance - amount) })
          .eq('id', paymentInvoice.customer_id)
      }
    }

    setPaymentInvoice(null)
    setSaving(false)
  }

  function displayStatus(inv: Invoice): { label: string; color: string } {
    if (isOverdue(inv)) return { label: 'Overdue', color: statusColor('overdue') }
    return { label: invoiceStatusLabel(inv.status), color: statusColor(inv.status) }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">{invoices.length} total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">🧾</p>
            <p className="font-medium">No invoices in this view</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Invoice #</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Due</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => {
                  const balance = inv.total_amount - inv.amount_paid
                  const { label: statusLabel, color: statusClass } = displayStatus(inv)
                  const canPay = inv.status === 'open' || inv.status === 'partial'
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-700">{inv.customers?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(inv.issue_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {inv.due_date
                          ? new Date(inv.due_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatUGX(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatUGX(inv.amount_paid)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={balance > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                          {formatUGX(balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canPay && (
                          <button
                            onClick={() => openPayment(inv)}
                            className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
              <button onClick={() => setPaymentInvoice(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Invoice {paymentInvoice.invoice_number} · Balance: {formatUGX(paymentInvoice.total_amount - paymentInvoice.amount_paid)}
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount (UGX)</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as 'cash' | 'mobile_money' | 'bank')}
                  className="input"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note (optional)</label>
                <input
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  className="input"
                  placeholder="Reference or note"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
