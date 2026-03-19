'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type Invoice, type InvoiceStatus, type BankAccount,
  formatUGX, invoiceStatusLabel, statusColor,
} from '@/lib/types'

type InvoiceWithDetails = Invoice & {
  customers: { name: string; phone: string } | null
  invoice_items: { id: string; qty: number; unit_price: number; description: string | null; products: { name: string } | null }[]
}

type FilterTab = 'all' | 'unpaid' | 'partial' | 'overdue' | 'paid'

interface Props {
  initialInvoices: InvoiceWithDetails[]
  businessId: string
  bankAccounts: BankAccount[]
}

function isOverdue(invoice: Invoice): boolean {
  return invoice.status === 'open' && !!invoice.due_date && new Date(invoice.due_date) < new Date()
}

function printInvoice(inv: InvoiceWithDetails) {
  const w = window.open('', '_blank', 'width=600,height=750')
  if (!w) return
  const balance = inv.total_amount - inv.amount_paid
  const rows = inv.invoice_items.map(item =>
    `<tr>
      <td style="padding:6px 8px;font-size:13px;">${item.products?.name ?? item.description ?? '—'}</td>
      <td style="padding:6px 8px;text-align:center;font-size:13px;">${item.qty}</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;">${formatUGX(item.unit_price)}</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;">${formatUGX(item.unit_price * item.qty)}</td>
    </tr>`
  ).join('')

  w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_number}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#1e293b;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;}
    .inv-title{font-size:28px;font-weight:700;color:#059669;}
    .meta{font-size:13px;color:#64748b;line-height:1.8;}
    table{width:100%;border-collapse:collapse;margin-top:24px;}
    thead{background:#f8fafc;}
    th{text-align:left;padding:8px;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;}
    th:last-child,th:nth-child(3){text-align:right;}
    th:nth-child(2){text-align:center;}
    tr:nth-child(even){background:#f8fafc;}
    .totals{margin-top:16px;text-align:right;}
    .totals .row{display:flex;justify-content:flex-end;gap:32px;padding:4px 8px;font-size:14px;}
    .totals .row.total{font-weight:700;font-size:16px;border-top:2px solid #e2e8f0;padding-top:8px;}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;}
    .paid{background:#d1fae5;color:#065f46;} .open{background:#dbeafe;color:#1e40af;}
    .partial{background:#fef3c7;color:#92400e;} .overdue{background:#fee2e2;color:#991b1b;}
    @media print{@page{margin:10mm;}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="inv-title">INVOICE</div>
      <div class="meta">
        Invoice #: <strong>${inv.invoice_number}</strong><br>
        Date: ${new Date(inv.issue_date).toLocaleDateString('en-UG',{day:'numeric',month:'long',year:'numeric'})}<br>
        ${inv.due_date ? `Due: ${new Date(inv.due_date).toLocaleDateString('en-UG',{day:'numeric',month:'long',year:'numeric'})}` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div class="meta">
        ${inv.customers ? `<strong>Bill To:</strong><br>${inv.customers.name}<br>${inv.customers.phone}` : 'Cash Sale'}
      </div>
      <br>
      <span class="badge ${isOverdue(inv)?'overdue':inv.status}">${isOverdue(inv)?'Overdue':invoiceStatusLabel(inv.status)}</span>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatUGX(inv.total_amount)}</span></div>
    <div class="row total"><span>TOTAL</span><span>${formatUGX(inv.total_amount)}</span></div>
    <div class="row"><span>Amount Paid</span><span style="color:#059669">${formatUGX(inv.amount_paid)}</span></div>
    ${balance > 0 ? `<div class="row"><span>Balance Due</span><span style="color:#dc2626;font-weight:700">${formatUGX(balance)}</span></div>` : ''}
  </div>
  ${inv.note ? `<div style="margin-top:24px;font-size:13px;color:#64748b;"><strong>Note:</strong> ${inv.note}</div>` : ''}
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`)
  w.document.close()
}

export default function InvoicesClient({ initialInvoices, businessId, bankAccounts }: Props) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>(initialInvoices)
  const [tab, setTab] = useState<FilterTab>('all')
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceWithDetails | null>(null)
  const [viewInvoice, setViewInvoice] = useState<InvoiceWithDetails | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'bank'>('cash')
  const [paymentAccountId, setPaymentAccountId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const cashDrawer = bankAccounts.find(a => a.account_type === 'cash_drawer')

  useEffect(() => {
    if (cashDrawer) setPaymentAccountId(cashDrawer.id)
  }, [cashDrawer])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

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

  function openPayment(invoice: InvoiceWithDetails) {
    setPaymentInvoice(invoice)
    const balance = invoice.total_amount - invoice.amount_paid
    setPaymentAmount(String(balance))
    setPaymentNote('')
    setPaymentMethod('cash')
    setPaymentAccountId(cashDrawer?.id ?? bankAccounts[0]?.id ?? '')
    setError('')
    setOpenMenuId(null)
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
      account_id: paymentAccountId || null,
      note: paymentNote.trim() || null,
    })

    if (payErr) { setError(payErr.message); setSaving(false); return }

    // Update account balance if account selected
    if (paymentAccountId) {
      const acc = bankAccounts.find(a => a.id === paymentAccountId)
      if (acc) {
        await supabase
          .from('bank_accounts')
          .update({ current_balance: acc.current_balance + amount })
          .eq('id', paymentAccountId)
      }
    }

    // Refresh the invoice from DB
    const { data: updated } = await supabase
      .from('invoices')
      .select('*, customers(name, phone), invoice_items(id, qty, unit_price, description, products(name))')
      .eq('id', paymentInvoice.id)
      .single()

    if (updated) {
      setInvoices(prev => prev.map(i => i.id === paymentInvoice.id ? updated as InvoiceWithDetails : i))
    }

    // If customer had credit, reduce their balance
    if (paymentInvoice.customer_id) {
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
                  <th className="px-4 py-3 w-10"></th>
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
                      {/* Action dropdown */}
                      <td className="px-4 py-3 relative" ref={openMenuId === inv.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
                          title="Actions"
                        >
                          ⌄
                        </button>
                        {openMenuId === inv.id && (
                          <div className="absolute right-0 top-10 z-20 bg-white border border-slate-200 rounded-xl shadow-lg w-44 py-1">
                            <button
                              onClick={() => { setViewInvoice(inv); setOpenMenuId(null) }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              👁️ View Invoice
                            </button>
                            <button
                              onClick={() => { printInvoice(inv); setOpenMenuId(null) }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              🖨️ Print Invoice
                            </button>
                            {canPay && (
                              <button
                                onClick={() => openPayment(inv)}
                                className="w-full text-left px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                              >
                                💳 Record Payment
                              </button>
                            )}
                          </div>
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

      {/* View Invoice Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{viewInvoice.invoice_number}</h2>
                <p className="text-sm text-slate-500">
                  {new Date(viewInvoice.issue_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {viewInvoice.customers ? ` · ${viewInvoice.customers.name}` : ' · Cash Sale'}
                </p>
              </div>
              <button onClick={() => setViewInvoice(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <div className="space-y-1 mb-4">
              {viewInvoice.invoice_items.map(item => (
                <div key={item.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700">{item.products?.name ?? item.description ?? '—'} × {item.qty}</span>
                  <span className="font-medium">{formatUGX(item.unit_price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm mb-4">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">{formatUGX(viewInvoice.total_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="text-emerald-700 font-medium">{formatUGX(viewInvoice.amount_paid)}</span></div>
              {viewInvoice.total_amount - viewInvoice.amount_paid > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Balance</span><span className="text-red-600 font-bold">{formatUGX(viewInvoice.total_amount - viewInvoice.amount_paid)}</span></div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { printInvoice(viewInvoice); setViewInvoice(null) }}
                className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1"
              >
                🖨️ Print
              </button>
              {(viewInvoice.status === 'open' || viewInvoice.status === 'partial') && (
                <button
                  onClick={() => { openPayment(viewInvoice); setViewInvoice(null) }}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                  Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
              {bankAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Receiving Account</label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="input"
                  >
                    <option value="">— None —</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
