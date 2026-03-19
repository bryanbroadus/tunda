// Supabase Edge Function: send-credit-reminders
// Triggered by pg_cron or manually. Sends SMS to customers with outstanding credit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const atApiKey = Deno.env.get('AT_API_KEY')!
    const atUsername = Deno.env.get('AT_USERNAME')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all enabled reminder configs
    const { data: configs, error: configError } = await supabase
      .from('reminder_config')
      .select('*, businesses(name)')
      .eq('is_enabled', true)

    if (configError) throw configError
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: 'No enabled configs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let totalSent = 0
    const results: { business_id: string; sent: number; errors: string[] }[] = []

    for (const config of configs) {
      const businessName = (config.businesses as { name: string } | null)?.name ?? 'your store'

      // Get customers with outstanding credit
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('name, phone, credit_balance')
        .eq('business_id', config.business_id)
        .gt('credit_balance', 0)
        .eq('is_active', true)

      if (custError || !customers?.length) continue

      const errors: string[] = []
      let sent = 0

      for (const customer of customers) {
        const message = config.message_template
          .replace('{name}', customer.name)
          .replace('{balance}', customer.credit_balance.toLocaleString())
          .replace('{business}', businessName)

        // Send via Africa's Talking SMS API
        try {
          const formData = new URLSearchParams({
            username: atUsername,
            to: customer.phone.startsWith('+') ? customer.phone : `+256${customer.phone.replace(/^0/, '')}`,
            message,
          })

          const atRes = await fetch('https://api.africastalking.com/version1/messaging', {
            method: 'POST',
            headers: {
              'apiKey': atApiKey,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData,
          })

          const atData = await atRes.json()
          const status = atData?.SMSMessageData?.Recipients?.[0]?.status

          if (status === 'Success') {
            sent++
          } else {
            errors.push(`${customer.name}: ${status ?? 'unknown error'}`)
          }
        } catch (err) {
          errors.push(`${customer.name}: ${String(err)}`)
        }
      }

      totalSent += sent
      results.push({ business_id: config.business_id, sent, errors })
    }

    return new Response(JSON.stringify({ totalSent, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
