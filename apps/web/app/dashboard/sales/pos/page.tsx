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

  const [{ data: products }, { data: customers }, { data: bankAccounts }, { data: business }] =
    await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gt('stock_qty', 0)
        .order('name'),
      supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('bank_accounts')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('account_type'),
      supabase
        .from('businesses')
        .select('name, business_phone, business_address, receipt_template, receipt_header, receipt_footer')
        .eq('id', businessId)
        .single(),
    ])

  return (
    <POSClient
      products={products ?? []}
      customers={customers ?? []}
      bankAccounts={bankAccounts ?? []}
      businessId={businessId}
      employeeId={employeeId}
      businessInfo={business ?? { name: '', business_phone: null, business_address: null, receipt_template: 1, receipt_header: null, receipt_footer: 'Thank you for your business!' }}
    />
  )
}
