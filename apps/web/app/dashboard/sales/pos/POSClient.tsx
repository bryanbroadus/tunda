'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Product, type Customer, type BankAccount, formatUGX } from '@/lib/types'

interface CartItem {
  product: Product
  qty: number
}

interface BusinessInfo {
  name: string
  business_phone: string | null
  business_address: string | null
  receipt_template: number
  receipt_header: string | null
  receipt_footer: string | null
}

interface ReceiptData {
  invoiceNumber: string
  items: CartItem[]
  total: number
  paymentType: 'cash' | 'credit'
  accountName: string
  customer: Customer | null
  saleDate: string
  business: BusinessInfo
}

interface Props {
  products: Product[]
  customers: Customer[]
  bankAccounts: BankAccount[]
  businessId: string
  employeeId: string
  businessInfo: BusinessInfo
}

function printReceipt(receipt: ReceiptData) {
  const w = window.open('', '_blank', 'width=380,height=600')
  if (!w) return
  const tpl = receipt.business.receipt_template ?? 1
  const isNarrow = tpl === 3

  const rows = receipt.items.map(item =>
    `<tr>
      <td style="padding:3px 6px;font-size:13px;">${item.product.name} × ${item.qty}</td>
      <td style="padding:3px 6px;text-align:right;font-size:13px;">${formatUGX(item.product.sell_price * item.qty)}</td>
    </tr>`
  ).join('')

  const headerBg = tpl === 5 ? '#059669' : tpl === 4 ? '#1e40af' : '#1e293b'
  const headerColor = '#ffffff'

  w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${receipt.invoiceNumber}</title>
  <style>
    body { font-family: ${isNarrow ? 'monospace' : 'system-ui, sans-serif'}; margin:0; padding:0; background:#fff; }
    .receipt { max-width:${isNarrow ? '320px' : '400px'}; margin:0 auto; padding:${tpl === 1 ? '16px' : '0'}; }
    .header { background:${tpl === 1 || tpl === 2 ? 'none' : headerBg}; color:${tpl === 1 || tpl === 2 ? '#111' : headerColor}; padding:${tpl === 1 ? '0 0 12px' : '20px 16px'}; text-align:center; }
    .business-name { font-size:${tpl === 3 ? '15px' : '20px'}; font-weight:bold; margin:0; letter-spacing:${isNarrow ? '1px' : '0'}; }
    .sub { font-size:12px; color:${tpl === 1 || tpl === 2 ? '#64748b' : 'rgba(255,255,255,0.8)'}; margin-top:2px; }
    .divider { border:none; border-top:${isNarrow ? '1px dashed #999' : '1px solid #e2e8f0'}; margin:10px 0; }
    .body { padding:${tpl === 1 ? '0' : '12px 16px'}; }
    table { width:100%; border-collapse:collapse; }
    .total-row td { font-weight:bold; font-size:14px; padding-top:8px; border-top:${isNarrow ? '1px dashed #999' : '2px solid #e2e8f0'}; }
    .meta { font-size:12px; color:#64748b; margin-bottom:4px; }
    .footer { text-align:center; font-size:12px; color:#64748b; padding:${tpl === 1 ? '12px 0 0' : '12px 16px'}; border-top:${tpl === 1 ? 'none' : '1px solid #e2e8f0'}; }
    @media print { @page { margin:4mm; } }
  </style></head><body>
  <div class="receipt">
    <div class="header">
      ${receipt.business.receipt_header ? `<p class="sub">${receipt.business.receipt_header}</p>` : ''}
      <p class="business-name">${receipt.business.name}</p>
      ${receipt.business.business_phone ? `<p class="sub">${receipt.business.business_phone}</p>` : ''}
      ${receipt.business.business_address ? `<p class="sub">${receipt.business.business_address}</p>` : ''}
    </div>
    <div class="body">
      <p class="meta">Receipt: <strong>${receipt.invoiceNumber}</strong></p>
      <p class="meta">Date: ${new Date(receipt.saleDate).toLocaleDateString('en-UG', { day:'numeric', month:'short', year:'numeric' })}</p>
      ${receipt.customer ? `<p class="meta">Customer: ${receipt.customer.name}</p>` : ''}
      <p class="meta">Payment: ${receipt.paymentType === 'cash' ? receipt.accountName : 'Credit / Account'}</p>
      <hr class="divider"/>
      <table>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td style="padding:3px 6px;">TOTAL</td>
            <td style="padding:3px 6px;text-align:right;">${formatUGX(receipt.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="footer">${receipt.business.receipt_footer ?? 'Thank you for your business!'}</div>
  </div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`)
  w.document.close()
}

export default function POSClient({ products, customers, bankAccounts, businessId, employeeId, businessInfo }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [note, setNote] = useState('')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // Default to Cash Drawer account
  const cashDrawer = bankAccounts.find(a => a.account_type === 'cash_drawer')
  const [selectedAccountId, setSelectedAccountId] = useState<string>(cashDrawer?.id ?? bankAccounts[0]?.id ?? '')

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId)

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  )

  const filteredCustomers = useMemo(() =>
    customers.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    ),
    [customers, customerSearch]
  )

  const cartTotal = cart.reduce((s, item) => s + item.product.sell_price * item.qty, 0)

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { product, qty: 1 }]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId))
    } else {
      setCart(prev => prev.map(i => i.product.id === productId ? { ...i, qty } : i))
    }
  }

  async function handleCheckout() {
    if (cart.length === 0) return
    if (paymentType === 'credit' && !selectedCustomer) {
      setError('Select a customer for credit sales.')
      return
    }
    setError('')
    setSubmitting(true)

    const supabase = createClient()

    const { data: invoiceNumber, error: rpcError } = await supabase
      .rpc('next_invoice_number', { p_business_id: businessId })

    if (rpcError || !invoiceNumber) {
      setError(rpcError?.message ?? 'Failed to generate invoice number')
      setSubmitting(false)
      return
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        employee_id: employeeId,
        customer_id: selectedCustomer?.id ?? null,
        invoice_number: invoiceNumber,
        status: paymentType === 'cash' ? 'paid' : 'open',
        issue_date: saleDate,
        total_amount: cartTotal,
        amount_paid: paymentType === 'cash' ? cartTotal : 0,
        payment_method: paymentType,
        note: note.trim() || null,
      })
      .select()
      .single()

    if (invoiceError) { setError(invoiceError.message); setSubmitting(false); return }

    const { error: itemsError } = await supabase.from('invoice_items').insert(
      cart.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product.id,
        qty: item.qty,
        unit_price: item.product.sell_price,
        unit_cost: item.product.buy_price,
      }))
    )
    if (itemsError) { setError(itemsError.message); setSubmitting(false); return }

    if (paymentType === 'cash') {
      await supabase.from('invoice_payments').insert({
        invoice_id: invoice.id,
        business_id: businessId,
        amount: cartTotal,
        payment_date: saleDate,
        payment_method: 'cash',
        account_id: selectedAccountId || null,
        note: null,
      })

      // Update bank account balance
      if (selectedAccount) {
        await supabase
          .from('bank_accounts')
          .update({ current_balance: selectedAccount.current_balance + cartTotal })
          .eq('id', selectedAccountId)
      }
    }

    // Deduct stock
    for (const item of cart) {
      await supabase
        .from('products')
        .update({ stock_qty: item.product.stock_qty - item.qty })
        .eq('id', item.product.id)
    }

    // For credit: update customer credit balance
    if (paymentType === 'credit' && selectedCustomer) {
      await supabase
        .from('customers')
        .update({ credit_balance: selectedCustomer.credit_balance + cartTotal })
        .eq('id', selectedCustomer.id)
    }

    const receiptData: ReceiptData = {
      invoiceNumber,
      items: cart,
      total: cartTotal,
      paymentType,
      accountName: selectedAccount?.name ?? 'Cash',
      customer: selectedCustomer,
      saleDate,
      business: businessInfo,
    }

    setReceipt(receiptData)
    setCart([])
    setNote('')
    setSelectedCustomer(null)
    setCustomerSearch('')
    setPaymentType('cash')
    setSaleDate(new Date().toISOString().split('T')[0])
    setSubmitting(false)
  }

  if (receipt) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Sale Complete!</h2>
          <p className="text-base font-medium text-emerald-700 mb-1">Receipt — {receipt.invoiceNumber}</p>
          <p className="text-sm text-slate-500 mb-6">
            {receipt.paymentType === 'cash'
              ? `Paid via ${receipt.accountName}.`
              : `Charged to ${receipt.customer?.name}'s account.`}
          </p>

          <div className="text-left bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Items</p>
            {receipt.items.map(item => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span>{item.product.name} × {item.qty}</span>
                <span className="font-medium">{formatUGX(item.product.sell_price * item.qty)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatUGX(receipt.total)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => printReceipt(receipt)}
              className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 flex items-center justify-center gap-2"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={() => setReceipt(null)}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Product grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Point of Sale</h1>
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input mb-4"
        />
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
            >
              <p className="font-medium text-slate-900 text-sm mb-1 truncate">{product.name}</p>
              {product.category && <p className="text-xs text-slate-400 mb-2">{product.category}</p>}
              <p className="text-emerald-700 font-bold text-sm">{formatUGX(product.sell_price)}</p>
              <p className={`text-xs mt-1 ${product.stock_qty <= product.low_stock_threshold ? 'text-red-500' : 'text-slate-400'}`}>
                {product.stock_qty} in stock
              </p>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-full text-center text-slate-400 py-12">No products found</p>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Cart</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Add items from the left</p>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.product.name}</p>
                  <p className="text-xs text-slate-500">{formatUGX(item.product.sell_price)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, item.qty - 1)}
                    className="w-6 h-6 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm leading-none">−</button>
                  <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, item.qty + 1)}
                    className="w-6 h-6 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm leading-none">+</button>
                </div>
                <span className="text-sm font-semibold w-20 text-right">{formatUGX(item.product.sell_price * item.qty)}</span>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-4 border-t border-slate-100 space-y-3">
          {/* Total */}
          <div className="flex justify-between font-bold text-slate-900">
            <span>Total</span>
            <span>{formatUGX(cartTotal)}</span>
          </div>

          {/* Payment type: Cash or Credit */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['cash', 'credit'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setPaymentType(type); if (type === 'cash') { setSelectedCustomer(null); setCustomerSearch('') } }}
                className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                  paymentType === type ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Payment account selector (cash only) */}
          {paymentType === 'cash' && bankAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Paying Account</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="input text-xs"
              >
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.account_type === 'mobile_money' && acc.provider ? ` (${acc.provider.toUpperCase()})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer selector for credit */}
          {paymentType === 'credit' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search customer…"
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); if (selectedCustomer) setSelectedCustomer(null) }}
                className="input text-xs"
              />
              {customerSearch && !selectedCustomer && filteredCustomers.length > 0 && (
                <div className="absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-slate-400 text-xs ml-2">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-1 bg-emerald-50 rounded-lg px-3 py-2 text-xs">
                  <span className="font-medium">{selectedCustomer.name}</span>
                  <span className="text-slate-500 ml-2">Balance: {formatUGX(selectedCustomer.credit_balance)}</span>
                  <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                    className="float-right text-slate-400 hover:text-red-500">×</button>
                </div>
              )}
            </div>
          )}

          {/* Sale Date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setSaleDate(e.target.value)}
              className="input text-xs"
            />
          </div>

          {/* Note */}
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input text-xs"
          />

          {error && <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{error}</p>}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Processing…' : `Confirm Sale · ${formatUGX(cartTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
