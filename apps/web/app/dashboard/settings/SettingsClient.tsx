'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLAN_LIMITS, formatUGX, type Plan } from '@/lib/types'

interface Props {
  business: { id: string; name: string; plan: string }
  employees: { id: string; role: string; user_id: string }[]
  currentUserId: string
}

export default function SettingsClient({ business, employees, currentUserId }: Props) {
  const [businessName, setBusinessName] = useState(business.name)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

  const limits = PLAN_LIMITS[business.plan as Plan]

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('businesses').update({ name: businessName.trim() }).eq('id', business.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMessage('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, businessId: business.id }),
    })

    if (res.ok) {
      setInviteMessage(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    } else {
      const { error } = await res.json()
      setInviteMessage(`Error: ${error}`)
    }
    setInviting(false)
  }

  const atUserLimit = employees.length >= limits.users

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Business name */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Business Details</h2>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Business Name</label>
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Name'}
          </button>
        </form>
      </section>

      {/* Plan info */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Current Plan</h2>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium capitalize">
            {business.plan}
          </span>
          <span className="text-sm text-slate-500">
            {limits.priceUGX === 0 ? 'Free' : `${formatUGX(limits.priceUGX)}/month`}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
          <p>Products: {limits.products === null ? 'Unlimited' : limits.products}</p>
          <p>Customers: {limits.customers === null ? 'Unlimited' : limits.customers}</p>
          <p>Team members: {limits.users}</p>
          <p>SMS reminders: {limits.sms ? `${limits.smsMonthly}/mo` : 'Not included'}</p>
        </div>
      </section>

      {/* Team */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-1">Team Members</h2>
        <p className="text-sm text-slate-500 mb-4">{employees.length} / {limits.users} members</p>

        <div className="space-y-2 mb-4">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-700">
                {emp.user_id === currentUserId ? 'You' : `Member ${emp.user_id.slice(0, 6)}…`}
              </span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 rounded capitalize">{emp.role}</span>
            </div>
          ))}
        </div>

        {atUserLimit ? (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">
            You've reached the {limits.users}-member limit. Upgrade your plan to add more team members.
          </p>
        ) : (
          <form onSubmit={handleInvite} className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Invite by Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="input"
                placeholder="colleague@example.com"
              />
            </div>
            {inviteMessage && (
              <p className={`text-sm px-3 py-2 rounded ${inviteMessage.startsWith('Error') ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                {inviteMessage}
              </p>
            )}
            <button type="submit" disabled={inviting}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
