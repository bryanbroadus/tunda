import { createClient } from '@/lib/supabase/server'
import POSClient from './POSClient'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('id, business_id, role')
    .eq('user_id', user!.id)
    .single()

  const businessId = employee?.business_id as string
  const employeeId = employee?.id as string

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gt('stock_qty', 0)
    .order('name')

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, credit_balance, credit_limit')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  return (
    <POSClient
      products={products ?? []}
      customers={customers ?? []}
      businessId={businessId}
      employeeId={employeeId}
    />
  )
}
