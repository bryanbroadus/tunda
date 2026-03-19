'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ReminderConfig } from '@/lib/types'

interface Props {
  businessId: string
  plan: string
  initialConfig: ReminderConfig | null
}

const DEFAULT_TEMPLATE = 'Hello {name}, you have an outstanding balance of UGX {balance} at {business}. Please make a payment. Thank you.'

export default function RemindersClient({ businessId, plan, initialConfig }: Props) {
  const hasSMS = plan === 'business' || plan === 'shop_plus'

  const [config, setConfig] = useState({
    is_enabled: initialConfig?.is_enabled ?? false,
    schedule: initialConfig?.schedule ?? 'weekly',
    custom_cron: initialConfig?.custom_cron ?? '',
    message_template: initialConfig?.message_template ?? DEFAULT_TEMPLATE,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      business_id: businessId,
      is_enabled: config.is_enabled,
      schedule: config.schedule,
      custom_cron: config.custom_cron.trim() || null,
      message_template: config.message_template,
      updated_at: new Date().toISOString(),
    }

    const { error } = initialConfig
      ? await supabase.from('reminder_config').update(payload).eq('business_id', businessId)
      : await supabase.from('reminder_config').insert(payload)

    if (error) { setError(error.message); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  if (!hasSMS) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">SMS Reminders</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="font-semibold text-amber-800 mb-2">Available on Business &amp; Shop+ plans</h2>
          <p className="text-sm text-amber-700">
            Upgrade to automatically send SMS payment reminders to customers with outstanding credit balances.
          </p>
          <div className="mt-4 text-sm text-amber-700 space-y-1">
            <p>✅ Business plan — 50 SMS/month free (UGX 60,000/month)</p>
            <p>✅ Shop+ plan — 200 SMS/month free (UGX 120,000/month)</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">SMS Reminders</h1>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Enable toggle */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-slate-900">Enable SMS Reminders</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Send automatic payment reminders to customers with outstanding balances.
              </p>
            </div>
            <div
              onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${config.is_enabled ? 'bg-emerald-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${config.is_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="font-medium text-slate-900 mb-3">Schedule</p>
          <div className="grid grid-cols-2 gap-2">
            {(['daily', 'weekly', 'monthly', 'custom'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setConfig(c => ({ ...c, schedule: s }))}
                className={`py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
                  config.schedule === s
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {config.schedule === 'custom' && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Custom Cron Expression</label>
              <input
                type="text"
                value={config.custom_cron}
                onChange={e => setConfig(c => ({ ...c, custom_cron: e.target.value }))}
                className="input"
                placeholder="e.g. 0 9 * * 1 (every Monday 9am)"
              />
            </div>
          )}
        </div>

        {/* Message template */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="font-medium text-slate-900 mb-1">Message Template</p>
          <p className="text-xs text-slate-500 mb-3">
            Variables: <code className="bg-slate-100 px-1 rounded">{'{name}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{balance}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{business}'}</code>
          </p>
          <textarea
            rows={4}
            value={config.message_template}
            onChange={e => setConfig(c => ({ ...c, message_template: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
