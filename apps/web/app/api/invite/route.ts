import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, businessId } = await request.json()

    if (!email || !businessId) {
      return NextResponse.json({ error: 'Missing email or businessId' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    // Verify the requesting user is an owner of this business
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: emp } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .single()

    if (emp?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Use service role to send invite
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: inviteData, error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding-employee?businessId=${businessId}`,
    })

    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 })

    // Pre-create an employee record (will be linked when they complete onboarding)
    await serviceSupabase.from('employees').insert({
      business_id: businessId,
      user_id: inviteData.user.id,
      role: 'employee',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
