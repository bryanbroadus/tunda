'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type BankAccount, type BankTransaction, type BankAccountType, formatUGX } from '@/lib/types'

interface Props {
  initialAccounts: BankAccount[]
  businessId: string
}

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  cash: 'Cash',
  checking: 'Checking',
  savings: 'Savings',
  mobile_money: 'Mobile Money',
}

const ACCOUNT_TYPE_COLORS: Record<BankAccountType, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  checking: 'bg-blue-100 text-blue-700',
  savings: 'bg-purple-100 text-purple-700',
  mobile_money: 'bg-orange-100 text-orange-700',
}

const EMPTY_ACCOUNT_FORM = {
  name: '',
  account_type: 'cash' as BankAccountType,
  institution: '',
  opening_balance: '',
}

const EMPTY_TX_FORM = {
  type: 'deposit' as 'deposit' | 'withdrawal',
  amount: '',
  description: '',
  transaction_date: new Date().toISOString().split('T')[0],
}

export default function BankingClient({ initialAccounts, businessId }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>(initialAccounts)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [showTxForm, setShowTxForm] = useState(false)
  const [txForm, setTxForm] = useState(EMPTY_TX_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0)

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()

    const { data, error } = await supabase.from('bank_accounts').insert({
      business_id: businessId,
      name: accountForm.name.trim(),
      account_type: accountForm.account_type,
      institution: accountForm.institution.trim() || null,
      opening_balance: parseFloat(accountForm.opening_balance) || 0,
      current_balance: parseFloat(accountForm.opening_balance) || 0,
    }).select().single()

    if (error) { setError(error.message); setSaving(false); return }
    setAccounts(prev => [...prev, data])
    setShowAccountForm(false)
    setAccountForm(EMPTY_ACCOUNT_FORM)
    setSaving(false)
  }

  async function openAccount(account: BankAccount) {
    setSelectedAccount(account)
    setLoadingTx(true)
    setShowTxForm(false)
    const supabase = createClient()
    const { data } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', account.id)
      .order('transaction_date', { ascending: false })
      .limit(50)
    setTransactions(data ?? [])
    setLoadingTx(false)
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount) return
    setError('')
    setSaving(true)
    const supabase = createClient()
    const amount = parseFloat(txForm.amount)

    const { error: txErr } = await supabase.from('bank_transactions').insert({
      bank_account_id: selectedAccount.id,
      business_id: businessId,
      type: txForm.type,
      amount,
      description: txForm.description.trim() || null,
      transaction_date: txForm.transaction_date,
    })

    if (txErr) { setError(txErr.message); setSaving(false); return }

    // Update current balance
    const newBalance = txForm.type === 'deposit'
      ? selectedAccount.current_balance + amount
      : selectedAccount.current_balance - amount

    const { data: updatedAccount, error: accErr } = await supabase
      .from('bank_accounts')
      .update({ current_balance: newBalance })
      .eq('id', selectedAccount.id)
      .select()
      .single()

    if (accErr) { setError(accErr.message); setSaving(false); return }

    setAccounts(prev => prev.map(a => a.id === selectedAccount.id ? updatedAccount : a))
    setSelectedAccount(updatedAccount)
    setShowTxForm(false)
    setTxForm(EMPTY_TX_FORM)
    setSaving(false)

    // Refresh transactions
    await openAccount(updatedAccount)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banking</h1>
          <p className="text-sm text-slate-500 mt-0.5">Total balance: {formatUGX(totalBalance)}</p>
        </div>
        <button
          onClick={() => { setShowAccountForm(true); setAccountForm(EMPTY_ACCOUNT_FORM); setError('') }}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          + Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200">
          <p className="text-5xl mb-4">🏦</p>
          <p className="text-lg font-medium text-slate-600 mb-1">Set up your bank accounts</p>
          <p className="text-sm">Track your cash, bank accounts, and mobile money in one place.</p>
          <button
            onClick={() => { setShowAccountForm(true); setAccountForm(EMPTY_ACCOUNT_FORM); setError('') }}
            className="mt-4 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            + Add Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(account => (
            <button
              key={account.id}
              onClick={() => openAccount(account)}
              className={`text-left bg-white rounded-xl border p-4 hover:shadow-md transition-all ${
                selectedAccount?.id === account.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-900 truncate">{account.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCOUNT_TYPE_COLORS[account.account_type]}`}>
                  {ACCOUNT_TYPE_LABELS[account.account_type]}
                </span>
              </div>
              {account.institution && (
                <p className="text-xs text-slate-400 mb-2">{account.institution}</p>
              )}
              <p className="text-2xl font-bold text-slate-900">{formatUGX(account.current_balance)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Account transactions panel */}
      {selectedAccount && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">{selectedAccount.name} — Transactions</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowTxForm(true); setTxForm(EMPTY_TX_FORM); setError('') }}
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
              >
                + New Transaction
              </button>
              <button
                onClick={() => { setSelectedAccount(null); setTransactions([]) }}
                className="px-3 py-1.5 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>

          {/* New Transaction Form */}
          {showTxForm && (
            <form onSubmit={handleAddTransaction} className="mb-4 p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={txForm.type}
                    onChange={e => setTxForm(f => ({ ...f, type: e.target.value as 'deposit' | 'withdrawal' }))}
                    className="input"
                  >
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (UGX)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={txForm.amount}
                    onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <input
                    value={txForm.description}
                    onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                    className="input"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={txForm.transaction_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Transaction'}
                </button>
                <button type="button" onClick={() => setShowTxForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Transactions list */}
          {loadingTx ? (
            <p className="text-center text-slate-400 py-8">Loading…</p>
          ) : transactions.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${tx.type === 'deposit' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-slate-900 capitalize">{tx.type}</span>
                      <span className="text-xs text-slate-400">{new Date(tx.transaction_date).toLocaleDateString('en-UG')}</span>
                    </div>
                    {tx.description && (
                      <p className="text-xs text-slate-500 mt-0.5 ml-4">{tx.description}</p>
                    )}
                  </div>
                  <span className={`font-semibold ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'deposit' ? '+' : '−'}{formatUGX(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAccountForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Add Bank Account</h2>
              <button onClick={() => setShowAccountForm(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Account Name *</label>
                <input required value={accountForm.name}
                  onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="e.g. Main Cash Till" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Account Type *</label>
                <select value={accountForm.account_type}
                  onChange={e => setAccountForm(f => ({ ...f, account_type: e.target.value as BankAccountType }))}
                  className="input">
                  <option value="cash">Cash</option>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Institution</label>
                <input value={accountForm.institution}
                  onChange={e => setAccountForm(f => ({ ...f, institution: e.target.value }))}
                  className="input" placeholder="e.g. Stanbic Bank, MTN" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Opening Balance (UGX)</label>
                <input type="number" min="0" value={accountForm.opening_balance}
                  onChange={e => setAccountForm(f => ({ ...f, opening_balance: e.target.value }))}
                  className="input" placeholder="0" />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
