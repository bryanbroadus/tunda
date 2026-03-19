'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatUGX, roleLabel, accountTypeLabel, type Role, type BankAccount, type BankAccountType, PLAN_LIMITS, type Plan } from '@/lib/types'

interface Employee {
  id: string
  role: Role
  user_id: string
  profiles?: { email: string } | null
}

interface BusinessInfo {
  id: string
  name: string
  plan: string
  receipt_template: number
  invoice_template: number
  business_phone: string | null
  business_address: string | null
  receipt_header: string | null
  receipt_footer: string | null
}

interface Props {
  business: BusinessInfo
  employees: Employee[]
  bankAccounts: BankAccount[]
  currentUserId: string
}

type SettingsTab = 'business' | 'team' | 'accounts' | 'receipts' | 'invoices'

const RECEIPT_TEMPLATES = [
  { id: 1, name: 'Simple', desc: 'Clean minimal receipt — plain text header' },
  { id: 2, name: 'Classic', desc: 'Business name + contact info, dividers' },
  { id: 3, name: 'Thermal', desc: 'Narrow monospace layout for 80mm thermal printers' },
  { id: 4, name: 'Professional', desc: 'Dark blue header with white text' },
  { id: 5, name: 'Branded', desc: 'Emerald green branded header' },
]

export default function SettingsClient({ business, employees: initEmployees, bankAccounts: initAccounts, currentUserId }: Props) {
  const [tab, setTab] = useState<SettingsTab>('business')

  // Business details state
  const [bizName, setBizName] = useState(business.name)
  const [bizPhone, setBizPhone] = useState(business.business_phone ?? '')
  const [bizAddress, setBizAddress] = useState(business.business_address ?? '')
  const [bizSaving, setBizSaving] = useState(false)
  const [bizSaved, setBizSaved] = useState(false)

  // Receipt settings
  const [receiptTemplate, setReceiptTemplate] = useState(business.receipt_template)
  const [invoiceTemplate, setInvoiceTemplate] = useState(business.invoice_template)
  const [receiptHeader, setReceiptHeader] = useState(business.receipt_header ?? '')
  const [receiptFooter, setReceiptFooter] = useState(business.receipt_footer ?? 'Thank you for your business!')
  const [tplSaving, setTplSaving] = useState(false)
  const [tplSaved, setTplSaved] = useState(false)

  // Team
  const [employees, setEmployees] = useState<Employee[]>(initEmployees)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('waiter')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  // Accounts
  const [accounts, setAccounts] = useState<BankAccount[]>(initAccounts)
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<BankAccountType>('mobile_money')
  const [newAccProvider, setNewAccProvider] = useState<'mtn' | 'airtel' | ''>('')
  const [accSaving, setAccSaving] = useState(false)
  const [accError, setAccError] = useState('')

  const limits = PLAN_LIMITS[business.plan as Plan]

  async function saveBusiness(e: React.FormEvent) {
    e.preventDefault()
    setBizSaving(true)
    const supabase = createClient()
    await supabase.from('businesses').update({
      name: bizName.trim(),
      business_phone: bizPhone.trim() || null,
      business_address: bizAddress.trim() || null,
    }).eq('id', business.id)
    setBizSaved(true)
    setTimeout(() => setBizSaved(false), 2500)
    setBizSaving(false)
  }

  async function saveTemplates(e: React.FormEvent) {
    e.preventDefault()
    setTplSaving(true)
    const supabase = createClient()
    await supabase.from('businesses').update({
      receipt_template: receiptTemplate,
      invoice_template: invoiceTemplate,
      receipt_header: receiptHeader.trim() || null,
      receipt_footer: receiptFooter.trim() || 'Thank you for your business!',
    }).eq('id', business.id)
    setTplSaved(true)
    setTimeout(() => setTplSaved(false), 2500)
    setTplSaving(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, businessId: business.id, role: inviteRole }),
    })
    if (res.ok) {
      setInviteMsg(`Invite sent to ${inviteEmail} as ${roleLabel(inviteRole)}`)
      setInviteEmail('')
    } else {
      const { error } = await res.json()
      setInviteMsg(`Error: ${error}`)
    }
    setInviting(false)
  }

  async function updateRole(empId: string, newRole: Role) {
    const supabase = createClient()
    await supabase.from('employees').update({ role: newRole }).eq('id', empId)
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, role: newRole } : e))
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccSaving(true)
    setAccError('')
    const supabase = createClient()
    const { data, error } = await supabase.from('bank_accounts').insert({
      business_id: business.id,
      name: newAccName.trim(),
      account_type: newAccType,
      provider: (newAccType === 'mobile_money' && newAccProvider) ? newAccProvider : null,
      opening_balance: 0,
      current_balance: 0,
    }).select().single()

    if (error) { setAccError(error.message); setAccSaving(false); return }
    setAccounts(prev => [...prev, data as BankAccount])
    setNewAccName('')
    setNewAccType('mobile_money')
    setNewAccProvider('')
    setAddingAccount(false)
    setAccSaving(false)
  }

  async function toggleAccount(accId: string, isActive: boolean) {
    const supabase = createClient()
    await supabase.from('bank_accounts').update({ is_active: !isActive }).eq('id', accId)
    setAccounts(prev => prev.map(a => a.id === accId ? { ...a, is_active: !isActive } : a))
  }

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'business', label: 'Business' },
    { key: 'team', label: 'Team & Roles' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'receipts', label: 'Receipt Templates' },
    { key: 'invoices', label: 'Invoice Templates' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BUSINESS ── */}
      {tab === 'business' && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Business Details</h2>
          <form onSubmit={saveBusiness} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Business Name</label>
              <input value={bizName} onChange={e => setBizName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
              <input value={bizPhone} onChange={e => setBizPhone(e.target.value)} className="input" placeholder="+256 700 000000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input value={bizAddress} onChange={e => setBizAddress(e.target.value)} className="input" placeholder="Plot 12, Kampala Road" />
            </div>
            <button type="submit" disabled={bizSaving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {bizSaved ? '✓ Saved' : bizSaving ? 'Saving…' : 'Save Details'}
            </button>
          </form>
        </section>
      )}

      {/* ── TEAM & ROLES ── */}
      {tab === 'team' && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Team Members</h2>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{employees.length} / {limits.users}</span>
            </div>

            <div className="space-y-2">
              {employees.map(emp => {
                const isMe = emp.user_id === currentUserId
                const isOwner = emp.role === 'owner'
                return (
                  <div key={emp.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {isMe ? 'You' : `Member ···${emp.user_id.slice(-6)}`}
                      </p>
                      <p className="text-xs text-slate-400">{emp.profiles?.email ?? ''}</p>
                    </div>
                    {isOwner || isMe ? (
                      <span className="text-xs px-2 py-1 bg-slate-100 rounded-full capitalize font-medium">{roleLabel(emp.role)}</span>
                    ) : (
                      <select
                        value={emp.role}
                        onChange={e => updateRole(emp.id, e.target.value as Role)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                      >
                        <option value="waiter">Waiter</option>
                        <option value="manager">Manager</option>
                        <option value="employee">Employee</option>
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-1">Invite Team Member</h2>
            <p className="text-xs text-slate-500 mb-4">
              <strong>Waiter</strong> — POS &amp; Invoices only<br />
              <strong>Manager</strong> — Sales, Purchases &amp; Accounting<br />
              <strong>Owner</strong> — Full access including Settings
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className="input" placeholder="colleague@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)} className="input">
                  <option value="waiter">Waiter — POS &amp; Invoices</option>
                  <option value="manager">Manager — Sales, Purchases, Accounting</option>
                  <option value="employee">Employee — Sales only</option>
                </select>
              </div>
              {inviteMsg && (
                <p className={`text-sm px-3 py-2 rounded ${inviteMsg.startsWith('Error') ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                  {inviteMsg}
                </p>
              )}
              <button type="submit" disabled={inviting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ── ACCOUNTS ── */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Payment Accounts</h2>
              <button onClick={() => setAddingAccount(true)}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                + Add Account
              </button>
            </div>

            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className={`flex items-center justify-between p-3 rounded-lg border ${acc.is_active ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{acc.name}</p>
                    <p className="text-xs text-slate-400">
                      {accountTypeLabel(acc.account_type)}
                      {acc.provider ? ` · ${acc.provider.toUpperCase()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{formatUGX(acc.current_balance)}</span>
                    {acc.account_type !== 'cash_drawer' && (
                      <button onClick={() => toggleAccount(acc.id, acc.is_active)}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${acc.is_active ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        {acc.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    {acc.account_type === 'cash_drawer' && (
                      <span className="text-xs text-slate-400 italic">Default</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Add account form */}
          {addingAccount && (
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">New Account</h2>
              <form onSubmit={addAccount} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Account Name</label>
                  <input required value={newAccName} onChange={e => setNewAccName(e.target.value)}
                    className="input" placeholder="e.g. MTN Mobile Money, Stanbic Bank" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Account Type</label>
                  <select value={newAccType} onChange={e => setNewAccType(e.target.value as BankAccountType)} className="input">
                    <option value="mobile_money">Mobile Money</option>
                    <option value="checking">Bank Account (Checking)</option>
                    <option value="savings">Bank Account (Savings)</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                {newAccType === 'mobile_money' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
                    <select value={newAccProvider} onChange={e => setNewAccProvider(e.target.value as 'mtn' | 'airtel' | '')} className="input">
                      <option value="">— Select provider —</option>
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                    </select>
                  </div>
                )}
                {accError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{accError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={accSaving}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                    {accSaving ? 'Saving…' : 'Add Account'}
                  </button>
                  <button type="button" onClick={() => setAddingAccount(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}

      {/* ── RECEIPT TEMPLATES ── */}
      {tab === 'receipts' && (
        <form onSubmit={saveTemplates} className="space-y-4">
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Receipt Template</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {RECEIPT_TEMPLATES.map(tpl => (
                <button key={tpl.id} type="button" onClick={() => setReceiptTemplate(tpl.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    receiptTemplate === tpl.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <p className="font-semibold text-slate-900 text-sm mb-0.5">{tpl.name}</p>
                  <p className="text-xs text-slate-500">{tpl.desc}</p>
                  {receiptTemplate === tpl.id && <p className="text-xs text-emerald-600 font-medium mt-2">✓ Selected</p>}
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Header Text (above business name)</label>
                <input value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)}
                  className="input" placeholder="e.g. Est. 2020" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Footer Message</label>
                <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)}
                  className="input" placeholder="Thank you for your business!" />
              </div>
              <p className="text-xs text-slate-400">Business name, phone, and address on receipts come from the Business tab.</p>
            </div>
          </section>

          <button type="submit" disabled={tplSaving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {tplSaved ? '✓ Saved' : tplSaving ? 'Saving…' : 'Save Receipt Settings'}
          </button>
        </form>
      )}

      {/* ── INVOICE TEMPLATES ── */}
      {tab === 'invoices' && (
        <form onSubmit={saveTemplates} className="space-y-4">
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Invoice Template</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RECEIPT_TEMPLATES.map(tpl => (
                <button key={tpl.id} type="button" onClick={() => setInvoiceTemplate(tpl.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    invoiceTemplate === tpl.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <p className="font-semibold text-slate-900 text-sm mb-0.5">{tpl.name}</p>
                  <p className="text-xs text-slate-500">{tpl.desc}</p>
                  {invoiceTemplate === tpl.id && <p className="text-xs text-emerald-600 font-medium mt-2">✓ Selected</p>}
                </button>
              ))}
            </div>
          </section>

          <button type="submit" disabled={tplSaving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {tplSaved ? '✓ Saved' : tplSaving ? 'Saving…' : 'Save Invoice Settings'}
          </button>
        </form>
      )}
    </div>
  )
}
