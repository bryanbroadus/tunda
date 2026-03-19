'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PurchaseCatalogItem, formatUGX } from '@/lib/types'

interface Props {
  initialItems: PurchaseCatalogItem[]
  businessId: string
}

const BLANK = { name: '', category: '', unit: '', default_cost: '' }

export default function CatalogClient({ initialItems, businessId }: Props) {
  const [items, setItems] = useState<PurchaseCatalogItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<PurchaseCatalogItem | null>(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditItem(null)
    setForm(BLANK)
    setShowForm(true)
    setError('')
  }

  function openEdit(item: PurchaseCatalogItem) {
    setEditItem(item)
    setForm({
      name: item.name,
      category: item.category ?? '',
      unit: item.unit ?? '',
      default_cost: String(item.default_cost),
    })
    setShowForm(true)
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      category: form.category.trim() || null,
      unit: form.unit.trim() || null,
      default_cost: parseFloat(form.default_cost) || 0,
    }

    if (editItem) {
      const { data, error: err } = await supabase
        .from('purchase_catalog')
        .update(payload)
        .eq('id', editItem.id)
        .select()
        .single()

      if (err) { setError(err.message); setSaving(false); return }
      setItems(prev => prev.map(i => i.id === editItem.id ? data as PurchaseCatalogItem : i))
    } else {
      const { data, error: err } = await supabase
        .from('purchase_catalog')
        .insert(payload)
        .select()
        .single()

      if (err) { setError(err.message); setSaving(false); return }
      setItems(prev => [data as PurchaseCatalogItem, ...prev])
    }

    setShowForm(false)
    setSaving(false)
  }

  async function toggleActive(item: PurchaseCatalogItem) {
    const supabase = createClient()
    await supabase.from('purchase_catalog').update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  const active = items.filter(i => i.is_active)
  const inactive = items.filter(i => !i.is_active)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Catalog</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vendor services and supplies (separate from products sold to customers)</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          + Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 text-slate-400">
          <p className="text-4xl mb-3">🗂️</p>
          <p className="font-medium mb-1">No catalog items yet</p>
          <p className="text-sm">Add services (cleaning, electrical work) or supplies that vendors provide.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Unit</th>
                  <th className="text-right px-4 py-3">Default Cost</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {active.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500">{item.category ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUGX(item.default_cost)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(item)}
                          className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50">
                          Edit
                        </button>
                        <button onClick={() => toggleActive(item)}
                          className="text-xs text-red-600 hover:text-red-700 px-2 py-1 border border-red-200 rounded-lg hover:bg-red-50">
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {inactive.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 opacity-40">
                    <td className="px-4 py-3 font-medium text-slate-900 line-through">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500">{item.category ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUGX(item.default_cost)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleActive(item)}
                        className="text-xs text-emerald-700 px-2 py-1 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                        Enable
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editItem ? 'Edit Item' : 'New Catalog Item'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="e.g. Cleaning Service, Electricity Repair" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="input" placeholder="e.g. Services, Supplies, Utilities" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
                <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="input" placeholder="e.g. per visit, per hour, per litre" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Default Cost (UGX)</label>
                <input type="number" min="0" value={form.default_cost}
                  onChange={e => setForm(f => ({ ...f, default_cost: e.target.value }))}
                  className="input" placeholder="0" />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
