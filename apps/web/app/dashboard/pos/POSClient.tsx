'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Product, type Customer, formatUGX } from '@/lib/types'

interface CartItem {
  product: Product
  qty: number
}

interface Props {
  products: Product[]
  customers: Customer[]
  businessId: string
  employeeId: string
}

export default function POSClient({ products, customers, businessId, employeeId }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<{ saleId: string; items: CartItem[]; total: number; paymentType: string; customer: Customer | null } | null>(null)

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

    // Insert sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        employee_id: employeeId,
        customer_id: selectedCustomer?.id ?? null,
        payment_type: paymentType,
        total_amount: cartTotal,
        note: note.trim() || null,
      })
      .select()
      .single()

    if (saleError) { setError(saleError.message); setSubmitting(false); return }

    // Insert sale items
    const { error: itemsError } = await supabase.from('sale_items').insert(
      cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        qty: item.qty,
        unit_price: item.product.sell_price,
        unit_cost: item.product.buy_price,
      }))
    )
    if (itemsError) { setError(itemsError.message); setSubmitting(false); return }

    // Deduct stock
    for (const item of cart) {
      await supabase
        .from('products')
        .update({ stock_qty: item.product.stock_qty - item.qty })
        .eq('id', item.product.id)
    }

    // Cash log
    await supabase.from('cash_log').insert({
      business_id: businessId,
      type: paymentType === 'cash' ? 'sale' : 'credit_payment',
      amount: cartTotal,
      note: `Sale #${sale.id.slice(0, 8)}`,
    })

    // Update customer credit balance
    if (paymentType === 'credit' && selectedCustomer) {
      await supabase
        .from('customers')
        .update({ credit_balance: selectedCustomer.credit_balance + cartTotal })
        .eq('id', selectedCustomer.id)
    }

    setReceipt({ saleId: sale.id, items: cart, total: cartTotal, paymentType, customer: selectedCustomer })
    setCart([])
    setNote('')
    setSelectedCustomer(null)
    setPaymentType('cash')
    setSubmitting(false)
  }

  if (receipt) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Sale Complete!</h2>
          <p className="text-sm text-slate-500 mb-6">
            {receipt.paymentType === 'cash' ? 'Cash payment received.' : `Charged to ${receipt.customer?.name}'s account.`}
          </p>

          <div className="text-left bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Receipt</p>
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

          <button
            onClick={() => setReceipt(null)}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
          >
            New Sale
          </button>
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

          {/* Payment type */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['cash', 'credit'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setPaymentType(type); if (type === 'cash') setSelectedCustomer(null) }}
                className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                  paymentType === type ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Customer selector for credit */}
          {paymentType === 'credit' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search customer…"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
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
