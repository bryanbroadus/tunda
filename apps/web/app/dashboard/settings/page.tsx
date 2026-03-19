import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role, businesses(*)')
    .eq('user_id', user!.id)
    .single()

  if (employee?.role !== 'owner') redirect('/dashboard')

  const business = employee.businesses as { id: string; name: string; plan: string } | null
  const { data: employees } = await supabase
    .from('employees')
    .select('id, role, user_id')
    .eq('business_id', employee.business_id)

  return (
    <SettingsClient
      business={business!}
      employees={employees ?? []}
      currentUserId={user!.id}
    />
  )
}
