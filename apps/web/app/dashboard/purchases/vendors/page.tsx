import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorsClient from './VendorsClient'

export default async function VendorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role')
    .eq('user_id', user!.id)
    .single()

  if (employee?.role !== 'owner') redirect('/dashboard')

  const businessId = employee.business_id as string

  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  return (
    <VendorsClient
      initialVendors={vendors ?? []}
      businessId={businessId}
    />
  )
}
