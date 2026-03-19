import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RemindersClient from './RemindersClient'

export default async function RemindersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role, businesses(plan)')
    .eq('user_id', user!.id)
    .single()

  if (employee?.role !== 'owner') redirect('/dashboard')

  const businessId = employee.business_id as string
  const plan = (employee.businesses as unknown as { plan: string } | null)?.plan ?? 'free'

  const { data: config } = await supabase
    .from('reminder_config')
    .select('*')
    .eq('business_id', businessId)
    .single()

  return <RemindersClient businessId={businessId} plan={plan} initialConfig={config} />
}
