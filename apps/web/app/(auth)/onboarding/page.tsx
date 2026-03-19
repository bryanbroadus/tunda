'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Create business
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .insert({ name: businessName.trim(), owner_id: user.id })
      .select()
      .single()

    if (bizError) {
      setError(bizError.message)
      setLoading(false)
      return
    }

    // Create owner employee record
    const { error: empError } = await supabase
      .from('employees')
      .insert({ business_id: business.id, user_id: user.id, role: 'owner' })

    if (empError) {
      setError(empError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Set up your business</h2>
      <p className="text-sm text-slate-500 mb-6">You can change this later in settings.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
          <input
            type="text"
            required
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g. Kampala Liquor Store"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !businessName.trim()}
          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating…' : 'Create Business & Continue'}
        </button>
      </form>
    </div>
  )
}
