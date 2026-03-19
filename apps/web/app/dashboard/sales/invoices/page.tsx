import { createClient } from '@/lib/supabase/server'
import InvoicesClient from './InvoicesClient'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role')
    .eq('user_id', user!.id)
    .single()

  const businessId = employee?.business_id as string

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, customers(name, phone)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  return (
    <InvoicesClient
      initialInvoices={invoices ?? []}
      businessId={businessId}
    />
  )
}
