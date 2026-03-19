'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Customer, formatUGX } from '@/lib/types'

interface Props {
  initialCustomers: Customer[]
  businessId: string
  role: 'owner' | 'employee'
}

interface Sale {
  id: string
  created_at: string
  total_amount: number
  payment_type: string
}

interface CreditPayment {
  id: string
  created_at: string
  amount: number
  note: string | null
}

export default function CustomersClient({ initialCustomers, businessId, role }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerHistory, setCustomerHistory] = useState<{ sales: Sale[]; payments: CreditPayment[] } | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [addForm, setAddForm] = useState({ name: '', phone: '', credit_limit: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() =>
    customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    ),
    [customers, search]
  )

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.from('customers').insert({
      business_id: businessId,
      name: addForm.name.trim(),
      phone: addForm.phone.trim(),
      credit_limit: parseFloat(addForm.credit_limit) || 0,
    }).select().single()

    if (error) { setError(error.message); setSaving(false); return }
    setCustomers(prev => [...prev, data])
    setShowAddForm(false)
    setAddForm({ name: '', phone: '', credit_limit: '' })
    setSaving(false)
  }

  async function openCustomer(customer: Customer) {
    setSelectedCustomer(customer)
    const supabase = createClient()
    const [{ data: sales }, { data: payments }] = await Promise.all([
      supabase.from('sales').select('id, created_at, total_amount, payment_type')
        .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('credit_payments').select('id, created_at, amount, note')
        .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
    ])
    setCustomerHistory({ sales: sales ?? [], payments: payments ?? [] })
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCustomer) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const amount = parseFloat(paymentAmount)

    const { error: payErr } = await supabase.from('credit_payments').insert({
      business_id: businessId,
      customer_id: selectedCustomer.id,
      amount,
      note: paymentNote.trim() || null,
    })
    if (payErr) { setError(payErr.message); setSaving(false); return }

    const newBalance = Math.max(0, selectedCustomer.credit_balance - amount)
    const { data: updated, error: updErr } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', selectedCustomer.id)
      .select()
      .single()
    if (updErr) { setError(updErr.message); setSaving(false); return }

    await supabase.from('cash_log').insert({
      business_id: businessId,
      type: 'credit_payment',
      amount,
      note: `Payment from ${selectedCustomer.name}`,
    })

    setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updated : c))
    setSelectedCustomer(updated)
    setShowPaymentForm(false)
    setPaymentAmount('')
    setPaymentNote('')
    setSaving(false)

    // Refresh history
    await openCustomer(updated)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setError('') }}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          + Add Customer
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input mb-4"
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-medium">No customers yet</p>
            <p className="text-sm mt-1">Add a customer to start tracking credit.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-right px-4 py-3">Credit Balance</th>
                <th className="text-right px-4 py-3">Credit Limit</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{customer.name}</td>
                  <td className="px-4 py-3 text-slate-500">{customer.phone}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${customer.credit_balance > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {formatUGX(customer.credit_balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatUGX(customer.credit_limit)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openCustomer(customer)}
                      className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddForm && (
        <Modal title="Add Customer" onClose={() => setShowAddForm(false)}>
          <form onSubmit={handleAddCustomer} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
              <input required value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="input" placeholder="e.g. John Musoke" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
              <input required value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                className="input" placeholder="e.g. 0772123456" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Credit Limit (UGX)</label>
              <input type="number" min="0" value={addForm.credit_limit}
                onChange={e => setAddForm(f => ({ ...f, credit_limit: e.target.value }))}
                className="input" placeholder="0 = no limit" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Customer'}
            </button>
          </form>
        </Modal>
      )}

      {/* Customer Detail Panel */}
      {selectedCustomer && (
        <Modal title={selectedCustomer.name} onClose={() => { setSelectedCustomer(null); setCustomerHistory(null); setShowPaymentForm(false) }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Outstanding Balance</p>
                <p className={`text-lg font-bold ${selectedCustomer.credit_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatUGX(selectedCustomer.credit_balance)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Phone</p>
                <p className="text-sm font-medium text-slate-900">{selectedCustomer.phone}</p>
              </div>
            </div>

            {selectedCustomer.credit_balance > 0 && (
              <>
                {!showPaymentForm ? (
                  <button
                    onClick={() => setShowPaymentForm(true)}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                  >
                    Record Payment
                  </button>
                ) : (
                  <form onSubmit={handleRecordPayment} className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Amount (UGX)</label>
                      <input required type="number" min="1" value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="input" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                      <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                        className="input" placeholder="Optional" />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                        {saving ? 'Saving…' : 'Confirm Payment'}
                      </button>
                      <button type="button" onClick={() => setShowPaymentForm(false)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* Transaction history */}
            {customerHistory && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Transaction History</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {[
                    ...customerHistory.sales.map(s => ({ type: 'sale' as const, date: s.created_at, amount: s.total_amount, label: `Sale (${s.payment_type})`, id: s.id })),
                    ...customerHistory.payments.map(p => ({ type: 'payment' as const, date: p.created_at, amount: p.amount, label: p.note ?? 'Payment', id: p.id })),
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                    <div key={tx.id} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm last:border-0">
                      <div>
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${tx.type === 'payment' ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                        <span className="text-slate-700">{tx.label}</span>
                        <span className="text-xs text-slate-400 ml-2">{new Date(tx.date).toLocaleDateString()}</span>
                      </div>
                      <span className={`font-medium ${tx.type === 'payment' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.type === 'payment' ? '−' : '+'}{formatUGX(tx.amount)}
                      </span>
                    </div>
                  ))}
                  {customerHistory.sales.length === 0 && customerHistory.payments.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No transactions yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}
