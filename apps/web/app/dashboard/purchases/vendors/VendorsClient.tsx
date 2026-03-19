'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Vendor } from '@/lib/types'

interface Props {
  initialVendors: Vendor[]
  businessId: string
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

export default function VendorsClient({ initialVendors, businessId }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors)
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditingVendor(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(vendor: Vendor) {
    setEditingVendor(vendor)
    setForm({
      name: vendor.name,
      phone: vendor.phone ?? '',
      email: vendor.email ?? '',
      address: vendor.address ?? '',
      notes: vendor.notes ?? '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()

    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    }

    if (editingVendor) {
      const { data, error } = await supabase
        .from('vendors')
        .update(payload)
        .eq('id', editingVendor.id)
        .select()
        .single()
      if (error) { setError(error.message); setSaving(false); return }
      setVendors(prev => prev.map(v => v.id === editingVendor.id ? data : v))
    } else {
      const { data, error } = await supabase.from('vendors').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      setVendors(prev => [...prev, data])
    }

    setShowForm(false)
    setSaving(false)
  }

  async function handleDeactivate(vendorId: string) {
    if (!confirm('Deactivate this vendor?')) return
    const supabase = createClient()
    const { error } = await supabase.from('vendors').update({ is_active: false }).eq('id', vendorId)
    if (!error) setVendors(prev => prev.filter(v => v.id !== vendorId))
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500 mt-0.5">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          + Add Vendor
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {vendors.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-5xl mb-4">🏪</p>
            <p className="text-lg font-medium text-slate-600 mb-1">Add your first vendor</p>
            <p className="text-sm">Track the suppliers you buy from and manage purchase bills.</p>
            <button
              onClick={openAdd}
              className="mt-4 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              + Add Vendor
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Address</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map(vendor => (
                <tr key={vendor.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-4 py-3 text-slate-500">{vendor.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{vendor.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{vendor.address ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(vendor)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(vendor.id)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Vendor Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="e.g. Uganda Breweries Ltd" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="input" placeholder="e.g. 0772123456" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input" placeholder="vendor@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="input" placeholder="e.g. Plot 14, Kampala Road" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="input resize-none" rows={2} placeholder="Any additional notes" />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : editingVendor ? 'Save Changes' : 'Add Vendor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
