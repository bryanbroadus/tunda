import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { formatUGX } from '@/lib/types'
import { fullSync } from '@/lib/offline/sync'

interface KPIs {
  todaySales: number
  todayCash: number
  receivables: number
  payables: number
  lowStockCount: number
  recentInvoices: { invoice_number: string; total_amount: number; status: string; customers: { name: string } | null }[]
}

export default function DashboardScreen() {
  const { employee, business, isOnline, setIsSyncing, setLastSyncedAt } = useStore()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadKPIs = useCallback(async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]

    const [todayInvoices, payments, openInvoices, openBills, lowStock, recent] = await Promise.all([
      supabase.from('invoices').select('total_amount').eq('business_id', employee.business_id)
        .neq('status', 'void').eq('issue_date', today),
      supabase.from('invoice_payments').select('amount').eq('business_id', employee.business_id)
        .eq('payment_date', today),
      supabase.from('invoices').select('total_amount, amount_paid')
        .eq('business_id', employee.business_id).in('status', ['open', 'partial']),
      supabase.from('purchase_bills').select('total_amount, amount_paid')
        .eq('business_id', employee.business_id).in('status', ['open', 'partial']),
      supabase.from('products').select('id').eq('business_id', employee.business_id)
        .eq('is_active', true).filter('stock_qty', 'lte', 'low_stock_threshold'),
      supabase.from('invoices').select('invoice_number, total_amount, status, customers(name)')
        .eq('business_id', employee.business_id).neq('status', 'void')
        .order('created_at', { ascending: false }).limit(5),
    ])

    setKpis({
      todaySales: todayInvoices.data?.reduce((s, i) => s + Number(i.total_amount), 0) ?? 0,
      todayCash: payments.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0,
      receivables: openInvoices.data?.reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0) ?? 0,
      payables: openBills.data?.reduce((s, b) => s + (Number(b.total_amount) - Number(b.amount_paid)), 0) ?? 0,
      lowStockCount: lowStock.data?.length ?? 0,
      recentInvoices: (recent.data ?? []) as any[],
    })
    setLoading(false)
  }, [employee])

  useEffect(() => { loadKPIs() }, [loadKPIs])

  async function handleRefresh() {
    if (!employee) return
    setRefreshing(true)
    setIsSyncing(true)
    try {
      await fullSync(employee.business_id)
      setLastSyncedAt(new Date().toISOString())
      await loadKPIs()
    } finally {
      setIsSyncing(false)
      setRefreshing(false)
    }
  }

  const statusColor = (status: string) => {
    const map: Record<string, string> = { paid: '#059669', open: '#3b82f6', partial: '#f59e0b', overdue: '#dc2626' }
    return map[status] ?? '#94a3b8'
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Offline — showing last synced data</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#059669" />}
      >
        {/* Business header */}
        <View style={styles.bizHeader}>
          <View style={styles.bizLogo}>
            <Text style={styles.bizLogoText}>{business?.name?.[0] ?? 'T'}</Text>
          </View>
          <View>
            <Text style={styles.bizName}>{business?.name ?? 'Tunda'}</Text>
            <Text style={styles.bizSub}>Today — {new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long' })}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#059669" size="large" style={{ marginTop: 48 }} />
        ) : kpis && (
          <>
            {/* KPI grid */}
            <View style={styles.kpiGrid}>
              <KPICard label="Today's Sales" value={formatUGX(kpis.todaySales)} color="#059669" />
              <KPICard label="Cash Collected" value={formatUGX(kpis.todayCash)} color="#3b82f6" />
              <KPICard label="Receivables" value={formatUGX(kpis.receivables)} color="#f59e0b" />
              <KPICard label="Payables" value={formatUGX(kpis.payables)} color="#dc2626" />
            </View>

            {/* Low stock alert */}
            {kpis.lowStockCount > 0 && (
              <View style={styles.alertCard}>
                <Text style={styles.alertText}>⚠️  {kpis.lowStockCount} product{kpis.lowStockCount > 1 ? 's' : ''} running low on stock</Text>
              </View>
            )}

            {/* Recent invoices */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Invoices</Text>
              {kpis.recentInvoices.length === 0 ? (
                <Text style={styles.empty}>No invoices yet today</Text>
              ) : kpis.recentInvoices.map(inv => (
                <View key={inv.invoice_number} style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNum}>{inv.invoice_number}</Text>
                    <Text style={styles.invCust}>{(inv.customers as any)?.name ?? 'Cash Sale'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.invAmount}>{formatUGX(inv.total_amount)}</Text>
                    <Text style={[styles.invStatus, { color: statusColor(inv.status) }]}>{inv.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  offlineBanner: { backgroundColor: '#fef3c7', paddingVertical: 8, paddingHorizontal: 16 },
  offlineText: { color: '#92400e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  bizHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  bizLogo: { width: 44, height: 44, backgroundColor: '#059669', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bizLogoText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  bizName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  bizSub: { fontSize: 13, color: '#64748b', marginTop: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  alertCard: { backgroundColor: '#fef3c7', borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  alertText: { color: '#92400e', fontWeight: '600', fontSize: 14 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  empty: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  invNum: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  invCust: { fontSize: 12, color: '#64748b', marginTop: 1 },
  invAmount: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  invStatus: { fontSize: 11, fontWeight: '700', marginTop: 1 },
})
