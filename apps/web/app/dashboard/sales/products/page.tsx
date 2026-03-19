import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role')
    .eq('user_id', user!.id)
    .single()

  const businessId = employee?.business_id as string
  const role = employee?.role as 'owner' | 'employee'

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  return (
    <ProductsClient
      initialProducts={products ?? []}
      businessId={businessId}
      role={role}
    />
  )
}
