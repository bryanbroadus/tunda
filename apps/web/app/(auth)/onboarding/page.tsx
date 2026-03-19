'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // On mount: check if this user already has a business set up (e.g. from a
  // previous partial attempt). If they do, skip straight to dashboard.
  useEffect(() => {
    async function checkExisting() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (employee) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    }
    checkExisting()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Guard: check again in case they have a business already (e.g. double submit)
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingEmployee) {
      router.replace('/dashboard')
      return
    }

    // Check if they have an orphaned business without an employee record
    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    let businessId: string

    if (existingBusiness) {
      // Repair: business exists but employee record is missing — just create the employee
      businessId = existingBusiness.id
    } else {
      // Normal path: create the business
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({ name: businessName.trim(), owner_id: user.id })
        .select('id')
        .single()

      if (bizError) {
        setError(bizError.message)
        setLoading(false)
        return
      }
      businessId = business.id
    }

    // Create the owner employee record
    const { error: empError } = await supabase
      .from('employees')
      .insert({ business_id: businessId, user_id: user.id, role: 'owner' })

    if (empError) {
      setError(empError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
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
