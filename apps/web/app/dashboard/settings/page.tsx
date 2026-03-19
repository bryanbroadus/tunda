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

  const businessId = employee.business_id as string
  const business = employee.businesses as unknown as {
    id: string; name: string; plan: string
    receipt_template: number; invoice_template: number
    business_phone: string | null; business_address: string | null
    receipt_header: string | null; receipt_footer: string | null
  } | null

  const [{ data: employees }, { data: bankAccounts }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, role, user_id')
      .eq('business_id', businessId),
    supabase
      .from('bank_accounts')
      .select('*')
      .eq('business_id', businessId)
      .order('account_type'),
  ])

  return (
    <SettingsClient
      business={business!}
      employees={employees ?? []}
      bankAccounts={bankAccounts ?? []}
      currentUserId={user!.id}
    />
  )
}
