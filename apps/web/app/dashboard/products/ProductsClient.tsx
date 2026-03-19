'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Product, formatUGX } from '@/lib/types'

interface Props {
  initialProducts: Product[]
  businessId: string
  role: 'owner' | 'employee'
}

const EMPTY_FORM = {
  name: '',
  category: '',
  buy_price: '',
  sell_price: '',
  stock_qty: '',
  low_stock_threshold: '5',
}

export default function ProductsClient({ initialProducts, businessId, role }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showAdjustForm, setShowAdjustForm] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adjustForm, setAdjustForm] = useState({ qty_change: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return cats.sort()
  }, [products])

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      const matchCat = !categoryFilter || p.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [products, search, categoryFilter])

  function openAdd() {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setForm({
      name: product.name,
      category: product.category ?? '',
      buy_price: String(product.buy_price),
      sell_price: String(product.sell_price),
      stock_qty: String(product.stock_qty),
      low_stock_threshold: String(product.low_stock_threshold),
    })
    setError('')
    setShowForm(true)
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()

    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      category: form.category.trim() || null,
      buy_price: parseFloat(form.buy_price),
      sell_price: parseFloat(form.sell_price),
      stock_qty: parseInt(form.stock_qty) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
    }

    if (editingProduct) {
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)
        .select()
        .single()
      if (error) { setError(error.message); setSaving(false); return }
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p))
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      setProducts(prev => [...prev, data])
    }

    setShowForm(false)
    setSaving(false)
  }

  async function handleDeactivate(productId: string) {
    if (!confirm('Remove this product from your inventory?')) return
    const supabase = createClient()
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', productId)
    if (!error) setProducts(prev => prev.filter(p => p.id !== productId))
  }

  async function handleAdjust(e: React.FormEvent, productId: string) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const qtyChange = parseInt(adjustForm.qty_change)

    const { error: adjError } = await supabase.from('stock_adjustments').insert({
      business_id: businessId,
      product_id: productId,
      qty_change: qtyChange,
      reason: adjustForm.reason.trim() || null,
    })
    if (adjError) { setError(adjError.message); setSaving(false); return }

    const { data, error: updError } = await supabase
      .from('products')
      .update({ stock_qty: products.find(p => p.id === productId)!.stock_qty + qtyChange })
      .eq('id', productId)
      .select()
      .single()
    if (updError) { setError(updError.message); setSaving(false); return }

    setProducts(prev => prev.map(p => p.id === productId ? data : p))
    setShowAdjustForm(null)
    setAdjustForm({ qty_change: '', reason: '' })
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        </div>
        {role === 'owner' && (
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-medium">No products found</p>
            {role === 'owner' && <p className="text-sm mt-1">Add your first product to get started.</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Buy Price</th>
                <th className="text-right px-4 py-3">Sell Price</th>
                <th className="text-right px-4 py-3">Stock</th>
                {role === 'owner' && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => {
                const lowStock = product.stock_qty <= product.low_stock_threshold
                return (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                    <td className="px-4 py-3 text-slate-500">{product.category ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatUGX(product.buy_price)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUGX(product.sell_price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>
                        {product.stock_qty}
                      </span>
                      {lowStock && <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Low</span>}
                    </td>
                    {role === 'owner' && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setShowAdjustForm(product.id); setAdjustForm({ qty_change: '', reason: '' }); setError('') }}
                            className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                          >
                            Adjust Stock
                          </button>
                          <button
                            onClick={() => openEdit(product)}
                            className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeactivate(product.id)}
                            className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <Modal title={editingProduct ? 'Edit Product' : 'Add Product'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSaveProduct} className="space-y-3">
            <Field label="Name">
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input" placeholder="e.g. Bell Lager 500ml" />
            </Field>
            <Field label="Category">
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="input" placeholder="e.g. Beverages" list="cats" />
              <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Buy Price (UGX)">
                <input required type="number" min="0" step="1" value={form.buy_price}
                  onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} className="input" placeholder="0" />
              </Field>
              <Field label="Sell Price (UGX)">
                <input required type="number" min="0" step="1" value={form.sell_price}
                  onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} className="input" placeholder="0" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock Qty">
                <input type="number" min="0" value={form.stock_qty}
                  onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} className="input" placeholder="0" />
              </Field>
              <Field label="Low Stock Alert">
                <input type="number" min="0" value={form.low_stock_threshold}
                  onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} className="input" placeholder="5" />
              </Field>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
            </button>
          </form>
        </Modal>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustForm && (
        <Modal
          title={`Adjust Stock — ${products.find(p => p.id === showAdjustForm)?.name}`}
          onClose={() => setShowAdjustForm(null)}
        >
          <form onSubmit={e => handleAdjust(e, showAdjustForm)} className="space-y-3">
            <Field label="Qty Change (positive = restock, negative = write-off)">
              <input required type="number" value={adjustForm.qty_change}
                onChange={e => setAdjustForm(f => ({ ...f, qty_change: e.target.value }))}
                className="input" placeholder="e.g. 24 or -3" />
            </Field>
            <Field label="Reason">
              <input value={adjustForm.reason}
                onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                className="input" placeholder="e.g. Received new stock" />
            </Field>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
            <button type="submit" disabled={saving || !adjustForm.qty_change}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
