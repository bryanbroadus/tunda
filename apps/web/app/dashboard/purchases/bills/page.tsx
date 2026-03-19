import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BillsClient from './BillsClient'

export default async function BillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role')
    .eq('user_id', user!.id)
    .single()

  if (employee?.role !== 'owner') redirect('/dashboard')

  const businessId = employee.business_id as string

  const [{ data: bills }, { data: vendors }, { data: products }] = await Promise.all([
    supabase
      .from('purchase_bills')
      .select('*, vendors(name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    supabase
      .from('vendors')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, buy_price')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <BillsClient
      initialBills={bills ?? []}
      vendors={vendors ?? []}
      products={products ?? []}
      businessId={businessId}
    />
  )
}
