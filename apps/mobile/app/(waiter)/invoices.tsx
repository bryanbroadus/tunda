import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { getInvoices, upsertInvoices } from '@/lib/offline/db'
import { formatUGX, type Invoice } from '@/lib/types'

type FilterTab = 'all' | 'unpaid' | 'partial' | 'paid'

function isOverdue(inv: Invoice): boolean {
  return inv.status === 'open' && !!inv.due_date && new Date(inv.due_date) < new Date()
}

function statusInfo(inv: Invoice): { label: string; color: string; bg: string } {
  if (isOverdue(inv)) return { label: 'Overdue', color: '#dc2626', bg: '#fee2e2' }
  const map: Record<string, { label: string; color: string; bg: string }> = {
    paid:    { label: 'Paid',    color: '#059669', bg: '#d1fae5' },
    partial: { label: 'Partial', color: '#d97706', bg: '#fef3c7' },
    open:    { label: 'Unpaid',  color: '#2563eb', bg: '#dbeafe' },
    draft:   { label: 'Draft',   color: '#64748b', bg: '#f1f5f9' },
  }
  return map[inv.status] ?? { label: inv.status, color: '#64748b', bg: '#f1f5f9' }
}

export default function InvoicesScreen() {
  const { employee, isOnline } = useStore()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tab, setTab] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [payingInv, setPayingInv] = useState<Invoice | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'mobile_money' | 'bank'>('cash')
  const [saving, setSaving] = useState(false)
  const [viewInv, setViewInv] = useState<Invoice | null>(null)

  const loadInvoices = useCallback(async () => {
    if (!employee) return
    if (isOnline) {
      const { data } = await supabase
        .from('invoices')
        .select('*, customers(name, phone)')
        .eq('business_id', employee.business_id)
        .neq('status', 'void')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) {
        await upsertInvoices(data)
        setInvoices(data as Invoice[])
      }
    } else {
      const local = await getInvoices(employee.business_id)
      setInvoices(local as Invoice[])
    }
    setLoading(false)
  }, [employee, isOnline])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  async function handleRefresh() {
    setRefreshing(true)
    await loadInvoices()
    setRefreshing(false)
  }

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (tab === 'all') return true
      if (tab === 'unpaid') return inv.status === 'open'
      if (tab === 'partial') return inv.status === 'partial'
      if (tab === 'paid') return inv.status === 'paid'
      return true
    })
  }, [invoices, tab])

  function openPayment(inv: Invoice) {
    setPayingInv(inv)
    setPayAmount(String(inv.total_amount - inv.amount_paid))
    setPayNote('')
    setPayMethod('cash')
  }

  async function recordPayment() {
    if (!payingInv || !employee) return
    setSaving(true)
    const amount = parseFloat(payAmount)
    const todayStr = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: payingInv.id,
      business_id: employee.business_id,
      amount,
      payment_date: todayStr,
      payment_method: payMethod,
      note: payNote.trim() || null,
    })

    if (!error) {
      await loadInvoices()
      setPayingInv(null)
    }
    setSaving(false)
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'partial', label: 'Partial' },
    { key: 'paid', label: 'Paid' },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Offline — showing cached invoices</Text>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#059669" size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#059669" />}
          renderItem={({ item: inv }) => {
            const balance = inv.total_amount - inv.amount_paid
            const { label, color, bg } = statusInfo(inv)
            const canPay = (inv.status === 'open' || inv.status === 'partial') && isOnline
            return (
              <TouchableOpacity style={styles.invCard} onPress={() => setViewInv(inv)}>
                <View style={styles.invTop}>
                  <Text style={styles.invNum}>{inv.invoice_number}</Text>
                  <View style={[styles.badge, { backgroundColor: bg }]}>
                    <Text style={[styles.badgeText, { color }]}>{label}</Text>
                  </View>
                </View>
                <Text style={styles.invCust}>{(inv as any).customers?.name ?? (inv as any).customer_name ?? 'Cash Sale'}</Text>
                <Text style={styles.invDate}>
                  {new Date(inv.issue_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                <View style={styles.invAmounts}>
                  <View>
                    <Text style={styles.amtLabel}>Total</Text>
                    <Text style={styles.amtValue}>{formatUGX(inv.total_amount)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amtLabel}>Paid</Text>
                    <Text style={[styles.amtValue, { color: '#059669' }]}>{formatUGX(inv.amount_paid)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amtLabel}>Balance</Text>
                    <Text style={[styles.amtValue, { color: balance > 0 ? '#dc2626' : '#94a3b8' }]}>{formatUGX(balance)}</Text>
                  </View>
                </View>
                {canPay && (
                  <TouchableOpacity style={styles.payBtn} onPress={(e) => { e.stopPropagation?.(); openPayment(inv) }}>
                    <Text style={styles.payBtnText}>Record Payment</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyText}>No invoices in this view</Text>
            </View>
          }
        />
      )}

      {/* View invoice modal */}
      <Modal visible={!!viewInv} animationType="slide" presentationStyle="pageSheet">
        {viewInv && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setViewInv(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{viewInv.invoice_number}</Text>
              <View style={{ width: 32 }} />
            </View>
            <View style={{ padding: 20 }}>
              <Text style={styles.viewDate}>{new Date(viewInv.issue_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              <Text style={styles.viewCust}>{(viewInv as any).customers?.name ?? (viewInv as any).customer_name ?? 'Cash Sale'}</Text>
              <View style={styles.viewAmounts}>
                <Row label="Total" value={formatUGX(viewInv.total_amount)} />
                <Row label="Paid" value={formatUGX(viewInv.amount_paid)} valueColor="#059669" />
                <Row label="Balance" value={formatUGX(viewInv.total_amount - viewInv.amount_paid)} valueColor="#dc2626" />
              </View>
              {(viewInv.status === 'open' || viewInv.status === 'partial') && isOnline && (
                <TouchableOpacity style={styles.payBtn} onPress={() => { setViewInv(null); openPayment(viewInv) }}>
                  <Text style={styles.payBtnText}>Record Payment</Text>
                </TouchableOpacity>
              )}
              {!isOnline && (
                <Text style={styles.offlineNote}>Connect to internet to record payments</Text>
              )}
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Record payment modal */}
      <Modal visible={!!payingInv} animationType="slide" presentationStyle="formSheet">
        {payingInv && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPayingInv(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <View style={{ width: 32 }} />
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={styles.paySubtitle}>
                {payingInv.invoice_number} · Balance {formatUGX(payingInv.total_amount - payingInv.amount_paid)}
              </Text>
              <View>
                <Text style={styles.fieldLabel}>Amount (UGX)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={payAmount} onChangeText={setPayAmount} />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Method</Text>
                <View style={styles.methodRow}>
                  {(['cash', 'mobile_money', 'bank'] as const).map(m => (
                    <TouchableOpacity key={m} style={[styles.methodBtn, payMethod === m && styles.methodBtnActive]} onPress={() => setPayMethod(m)}>
                      <Text style={[styles.methodBtnText, payMethod === m && styles.methodBtnTextActive]}>
                        {m === 'cash' ? 'Cash' : m === 'mobile_money' ? 'MoMo' : 'Bank'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text style={styles.fieldLabel}>Note (optional)</Text>
                <TextInput style={styles.input} value={payNote} onChangeText={setPayNote} placeholder="Reference…" placeholderTextColor="#94a3b8" />
              </View>
              <TouchableOpacity style={[styles.checkoutBtn, saving && { opacity: 0.6 }]} onPress={recordPayment} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Confirm Payment</Text>}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
      <Text style={{ color: '#64748b', fontSize: 14 }}>{label}</Text>
      <Text style={{ color: valueColor ?? '#0f172a', fontWeight: '700', fontSize: 14 }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  offlineBanner: { backgroundColor: '#fef3c7', paddingVertical: 7, paddingHorizontal: 16 },
  offlineText: { color: '#92400e', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tabRow: { flexDirection: 'row', padding: 12, gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  tabBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#fff' },
  list: { padding: 12, paddingBottom: 32 },
  invCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  invTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  invNum: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  invCust: { fontSize: 13, color: '#334155', fontWeight: '500', marginBottom: 2 },
  invDate: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  invAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  amtLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  amtValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  payBtn: { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyWrap: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalClose: { fontSize: 18, color: '#64748b', width: 32 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  viewDate: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  viewCust: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  viewAmounts: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 20 },
  paySubtitle: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  methodBtnActive: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  methodBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  methodBtnTextActive: { color: '#059669' },
  checkoutBtn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineNote: { textAlign: 'center', color: '#f59e0b', fontSize: 13, marginTop: 12 },
})
