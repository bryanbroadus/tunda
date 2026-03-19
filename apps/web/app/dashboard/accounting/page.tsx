import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountingClient from './AccountingClient'

export default async function AccountingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role, businesses(plan)')
    .eq('user_id', user!.id)
    .single()

  if (employee?.role !== 'owner') redirect('/dashboard')

  const businessId = employee.business_id as string
  const plan = (employee.businesses as { plan: string } | null)?.plan ?? 'free'

  return <AccountingClient businessId={businessId} plan={plan} />
}
