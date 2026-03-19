import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CatalogClient from './CatalogClient'

export default async function PurchaseCatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role')
    .eq('user_id', user!.id)
    .single()

  if (!employee || (employee.role !== 'owner' && employee.role !== 'manager')) {
    redirect('/dashboard')
  }

  const businessId = employee.business_id as string

  const { data: items } = await supabase
    .from('purchase_catalog')
    .select('*')
    .eq('business_id', businessId)
    .order('name')

  return <CatalogClient initialItems={items ?? []} businessId={businessId} />
}
