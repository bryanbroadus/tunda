import { supabase } from '@/lib/supabase'
import {
  upsertProducts, upsertCustomers, upsertInvoices, upsertBankAccounts,
  getPendingQueue, markQueueItem,
} from './db'

// Pull latest data from Supabase into SQLite
export async function syncDown(businessId: string): Promise<void> {
  try {
    const [products, customers, invoices, accounts] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('invoices').select('*, customers(name, phone)').eq('business_id', businessId)
        .neq('status', 'void').order('created_at', { ascending: false }).limit(100),
      supabase.from('bank_accounts').select('*').eq('business_id', businessId).eq('is_active', true),
    ])

    if (products.data)  await upsertProducts(products.data)
    if (customers.data) await upsertCustomers(customers.data)
    if (invoices.data)  await upsertInvoices(invoices.data)
    if (accounts.data)  await upsertBankAccounts(accounts.data)
  } catch (err) {
    console.warn('[sync] syncDown failed:', err)
  }
}

// Push queued offline sales to Supabase
export async function syncUp(businessId: string): Promise<{ synced: number; failed: number }> {
  const queue = await getPendingQueue()
  let synced = 0
  let failed = 0

  for (const item of queue) {
    try {
      const payload = JSON.parse(item.payload)

      if (item.type === 'sale') {
        await processSale(payload, businessId)
        await markQueueItem(item.id, 'synced')
        synced++
      }
    } catch (err: any) {
      console.warn('[sync] syncUp item failed:', err)
      await markQueueItem(item.id, 'failed', err?.message ?? 'Unknown error')
      failed++
    }
  }

  return { synced, failed }
}

async function processSale(payload: any, businessId: string) {
  // Get a real invoice number
  const { data: invoiceNumber, error: rpcErr } = await supabase
    .rpc('next_invoice_number', { p_business_id: businessId })
  if (rpcErr || !invoiceNumber) throw new Error('Failed to get invoice number')

  // Create invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      business_id: businessId,
      employee_id: payload.employeeId,
      customer_id: payload.customerId ?? null,
      invoice_number: invoiceNumber,
      status: payload.paymentType === 'cash' ? 'paid' : 'open',
      issue_date: payload.saleDate,
      total_amount: payload.total,
      amount_paid: payload.paymentType === 'cash' ? payload.total : 0,
      payment_method: payload.paymentType,
      note: payload.note ?? null,
      created_at: payload.createdAt,
    })
    .select()
    .single()
  if (invErr) throw invErr

  // Insert items
  await supabase.from('invoice_items').insert(
    payload.items.map((item: any) => ({
      invoice_id: invoice.id,
      product_id: item.product.id,
      qty: item.qty,
      unit_price: item.product.sell_price,
      unit_cost: item.product.buy_price,
    }))
  )

  // Payment record for cash
  if (payload.paymentType === 'cash') {
    await supabase.from('invoice_payments').insert({
      invoice_id: invoice.id,
      business_id: businessId,
      amount: payload.total,
      payment_date: payload.saleDate,
      payment_method: 'cash',
      account_id: payload.accountId ?? null,
    })
  }

  // Update customer credit balance
  if (payload.paymentType === 'credit' && payload.customerId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', payload.customerId)
      .single()
    if (cust) {
      await supabase.from('customers')
        .update({ credit_balance: cust.credit_balance + payload.total })
        .eq('id', payload.customerId)
    }
  }
}

// Full sync: pull down then push up
export async function fullSync(businessId: string) {
  await syncDown(businessId)
  return syncUp(businessId)
}
