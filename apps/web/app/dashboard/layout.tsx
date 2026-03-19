import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user has a business set up
  const { data: employee } = await supabase
    .from('employees')
    .select('id, role, business_id, businesses(id, name, plan)')
    .eq('user_id', user.id)
    .single()

  if (!employee) redirect('/onboarding')

  const business = employee.businesses as unknown as { id: string; name: string; plan: string } | null
  if (!business) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar business={business} role={employee.role as 'owner' | 'employee'} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
