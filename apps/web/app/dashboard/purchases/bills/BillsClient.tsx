'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PurchaseBill, type BillStatus, formatUGX, billStatusLabel, statusColor } from '@/lib/types'

type BillWithVendor = PurchaseBill & { vendors: { name: string } | null }

interface VendorOption { id: string; name: string }
interface ProductOption { id: string; name: string; buy_price: number }

interface LineItem {
  product_id: string
  description: string
  qty: string
  unit_cost: string
}

interface Props {
  initialBills: BillWithVendor[]
  vendors: VendorOption[]
  products: ProductOption[]
  businessId: string
}

const emptyLine = (): LineItem => ({ product_id: '', description: '', qty: '1', unit_cost: '' })

export default function BillsClient({ initialBills, vendors, products, businessId }: Props) {
  const [bills, setBills] = useState<BillWithVendor[]>(initialBills)
  const [showNewBill, setShowNewBill] = useState(false)
  const [paymentBill, setPaymentBill] = useState<BillWithVendor | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // New bill form state
  const [billVendorId, setBillVendorId] = useState('')
  const [billDueDate, setBillDueDate] = useState('')
  const [billNotes, setBillNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()])

  const billTotal = lineItems.reduce((s, li) => {
    const qty = parseInt(li.qty) || 0
    const cost = parseFloat(li.unit_cost) || 0
    return s + qty * cost
  }, 0)

  function addLineItem() {
    setLineItems(prev => [...prev, emptyLine()])
  }

  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== idx) return li
      const updated = { ...li, [field]: value }
      // Auto-fill unit cost from product
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.description = prod.name
          updated.unit_cost = String(prod.buy_price)
        }
      }
      return updated
    }))
  }

  function resetBillForm() {
    setBillVendorId('')
    setBillDueDate('')
    setBillNotes('')
    setLineItems([emptyLine()])
    setError('')
    setSuccessMsg('')
  }

  async function handleSaveBill(e: React.FormEvent) {
    e.preventDefault()
    const validLines = lineItems.filter(li => li.qty && li.unit_cost && (li.product_id || li.description.trim()))
    if (validLines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    setSaving(true)
    setError('')

    const supabase = createClient()

    // Get bill number
    const { data: billNumber, error: rpcError } = await supabase
      .rpc('next_bill_number', { p_business_id: businessId })

    if (rpcError || !billNumber) {
      setError(rpcError?.message ?? 'Failed to generate bill number')
      setSaving(false)
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const totalAmount = validLines.reduce((s, li) => s + (parseInt(li.qty) || 0) * (parseFloat(li.unit_cost) || 0), 0)

    const { data: bill, error: billError } = await supabase
      .from('purchase_bills')
      .insert({
        business_id: businessId,
        vendor_id: billVendorId || null,
        bill_number: billNumber,
        status: 'open',
        issue_date: todayStr,
        due_date: billDueDate || null,
        total_amount: totalAmount,
        notes: billNotes.trim() || null,
      })
      .select('*, vendors(name)')
      .single()

    if (billError) { setError(billError.message); setSaving(false); return }

    // Insert line items
    const { error: itemsError } = await supabase.from('purchase_bill_items').insert(
      validLines.map(li => ({
        bill_id: bill.id,
        product_id: li.product_id || null,
        description: li.description.trim() || null,
        qty: parseInt(li.qty),
        unit_cost: parseFloat(li.unit_cost),
      }))
    )

    if (itemsError) { setError(itemsError.message); setSaving(false); return }

    setBills(prev => [bill as BillWithVendor, ...prev])
    setSuccessMsg(`Bill ${billNumber} created. Stock updated automatically.`)
    resetBillForm()
    setSaving(false)
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentBill) return
    setSaving(true)
    setError('')

    const supabase = createClient()
    const amount = parseFloat(paymentAmount)
    const todayStr = new Date().toISOString().split('T')[0]

    const { error: payErr } = await supabase.from('purchase_bill_payments').insert({
      bill_id: paymentBill.id,
      business_id: businessId,
      amount,
      payment_date: todayStr,
      note: paymentNote.trim() || null,
    })

    if (payErr) { setError(payErr.message); setSaving(false); return }

    // Refresh bill from DB
    const { data: updated } = await supabase
      .from('purchase_bills')
      .select('*, vendors(name)')
      .eq('id', paymentBill.id)
      .single()

    if (updated) {
      setBills(prev => prev.map(b => b.id === paymentBill.id ? updated as BillWithVendor : b))
    }

    setPaymentBill(null)
    setPaymentAmount('')
    setPaymentNote('')
    setSaving(false)
  }

  function openPayment(bill: BillWithVendor) {
    setPaymentBill(bill)
    const balance = bill.total_amount - bill.amount_paid
    setPaymentAmount(String(balance))
    setPaymentNote('')
    setError('')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowNewBill(true); resetBillForm() }}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          + New Bill
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Bills table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {bills.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-5xl mb-4">📄</p>
            <p className="text-lg font-medium text-slate-600 mb-1">No bills yet</p>
            <p className="text-sm">Create a bill when you receive goods from a vendor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Bill #</th>
                  <th className="text-left px-4 py-3">Vendor</th>
                  <th className="text-left px-4 py-3">Issue Date</th>
                  <th className="text-left px-4 py-3">Due Date</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map(bill => {
                  const balance = bill.total_amount - bill.amount_paid
                  const canPay = bill.status === 'open' || bill.status === 'partial'
                  return (
                    <tr key={bill.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{bill.bill_number}</td>
                      <td className="px-4 py-3 text-slate-700">{bill.vendors?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(bill.issue_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {bill.due_date
                          ? new Date(bill.due_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatUGX(bill.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatUGX(bill.amount_paid)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={balance > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                          {formatUGX(balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bill.status)}`}>
                          {billStatusLabel(bill.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canPay && (
                          <button
                            onClick={() => openPayment(bill)}
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

      {/* New Bill Modal */}
      {showNewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">New Purchase Bill</h2>
              <button onClick={() => setShowNewBill(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-4">
              {/* Vendor & dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
                  <select
                    value={billVendorId}
                    onChange={e => setBillVendorId(e.target.value)}
                    className="input"
                  >
                    <option value="">— Select vendor —</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due Date (optional)</label>
                  <input
                    type="date"
                    value={billDueDate}
                    onChange={e => setBillDueDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                <input
                  value={billNotes}
                  onChange={e => setBillNotes(e.target.value)}
                  className="input"
                  placeholder="Reference number, delivery note, etc."
                />
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-600">Line Items</label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="text-left px-3 py-2">Product / Description</th>
                        <th className="text-right px-3 py-2 w-20">Qty</th>
                        <th className="text-right px-3 py-2 w-32">Unit Cost (UGX)</th>
                        <th className="text-right px-3 py-2 w-28">Total</th>
                        <th className="w-8 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((li, idx) => {
                        const lineTotal = (parseInt(li.qty) || 0) * (parseFloat(li.unit_cost) || 0)
                        return (
                          <tr key={idx}>
                            <td className="px-2 py-1.5">
                              <select
                                value={li.product_id}
                                onChange={e => updateLine(idx, 'product_id', e.target.value)}
                                className="input text-xs mb-1"
                              >
                                <option value="">— Select product —</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              {!li.product_id && (
                                <input
                                  value={li.description}
                                  onChange={e => updateLine(idx, 'description', e.target.value)}
                                  className="input text-xs"
                                  placeholder="Or type description…"
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min="1"
                                value={li.qty}
                                onChange={e => updateLine(idx, 'qty', e.target.value)}
                                className="input text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min="0"
                                value={li.unit_cost}
                                onChange={e => updateLine(idx, 'unit_cost', e.target.value)}
                                className="input text-xs text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-700 font-medium text-xs">
                              {formatUGX(lineTotal)}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {lineItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(idx)}
                                  className="text-slate-300 hover:text-red-500 text-lg leading-none"
                                >
                                  &times;
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">Total:</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">{formatUGX(billTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Bill'}
                </button>
                <button type="button" onClick={() => setShowNewBill(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
              <button onClick={() => setPaymentBill(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Bill {paymentBill.bill_number} · Balance: {formatUGX(paymentBill.total_amount - paymentBill.amount_paid)}
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
