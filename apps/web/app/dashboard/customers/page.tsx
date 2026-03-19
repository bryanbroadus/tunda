import { createClient } from '@/lib/supabase/server'
import CustomersClient from './CustomersClient'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role, businesses(plan)')
    .eq('user_id', user!.id)
    .single()

  const businessId = employee?.business_id as string
  const plan = (employee?.businesses as unknown as { plan: string } | null)?.plan ?? 'free'
  const role = employee?.role as 'owner' | 'employee'

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  return (
    <CustomersClient
      initialCustomers={customers ?? []}
      businessId={businessId}
      plan={plan}
      role={role}
    />
  )
}
