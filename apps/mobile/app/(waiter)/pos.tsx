import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { getProducts, getCustomers, getBankAccounts, deductProductStock, enqueueItem, getPendingQueue } from '@/lib/offline/db'
import { syncUp } from '@/lib/offline/sync'
import { formatUGX, type Product, type Customer, type BankAccount, type CartItem, type PaymentType } from '@/lib/types'

export default function POSScreen() {
  const { employee, business, isOnline, setPendingCount } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [saleDate] = useState(() => new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receiptData, setReceiptData] = useState<{ invoiceNumber: string; items: CartItem[]; total: number; paymentType: string; accountName: string } | null>(null)

  const cartTotal = cart.reduce((s, i) => s + i.product.sell_price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  const loadLocalData = useCallback(async () => {
    if (!employee) return
    const [prods, custs, accs] = await Promise.all([
      getProducts(employee.business_id),
      getCustomers(employee.business_id),
      getBankAccounts(employee.business_id),
    ])
    setProducts(prods as Product[])
    setCustomers(custs as Customer[])
    setAccounts(accs as BankAccount[])
    const cashDrawer = (accs as BankAccount[]).find(a => a.account_type === 'cash_drawer')
    if (cashDrawer) setSelectedAccountId(cashDrawer.id)
  }, [employee])

  useEffect(() => { loadLocalData() }, [loadLocalData])

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

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  async function handleCheckout() {
    if (cart.length === 0) return
    if (paymentType === 'credit' && !selectedCustomer) {
      Alert.alert('Select customer', 'Please choose a customer for credit sales.')
      return
    }
    setSubmitting(true)

    const salePayload = {
      employeeId: employee!.id,
      customerId: selectedCustomer?.id ?? null,
      customerName: selectedCustomer?.name ?? null,
      items: cart,
      total: cartTotal,
      paymentType,
      accountId: paymentType === 'cash' ? selectedAccountId : null,
      saleDate,
      note: note.trim() || null,
      createdAt: new Date().toISOString(),
    }

    // Deduct stock locally
    for (const item of cart) {
      await deductProductStock(item.product.id, item.qty)
    }

    if (isOnline) {
      // Try to sync immediately
      try {
        const queueId = await enqueueItem('sale', salePayload)
        const result = await syncUp(employee!.business_id)
        const invoiceNum = result.synced > 0 ? 'Synced' : 'OFFLINE'
        setReceiptData({
          invoiceNumber: invoiceNum,
          items: cart,
          total: cartTotal,
          paymentType,
          accountName: accounts.find(a => a.id === selectedAccountId)?.name ?? 'Cash',
        })
      } catch {
        await enqueueItem('sale', salePayload)
        showOfflineReceipt()
      }
    } else {
      await enqueueItem('sale', salePayload)
      showOfflineReceipt()
    }

    // Update pending count
    const pending = await getPendingQueue()
    setPendingCount(pending.length)

    // Reload products (stock updated)
    await loadLocalData()
    resetCart()
    setSubmitting(false)
  }

  function showOfflineReceipt() {
    setReceiptData({
      invoiceNumber: `PENDING-${Date.now()}`,
      items: cart,
      total: cartTotal,
      paymentType,
      accountName: accounts.find(a => a.id === selectedAccountId)?.name ?? 'Cash',
    })
  }

  function resetCart() {
    setCart([])
    setNote('')
    setSelectedCustomer(null)
    setCustomerSearch('')
    setPaymentType('cash')
    setCartOpen(false)
  }

  // ── Receipt screen ───────────────────────────────────────
  if (receiptData) {
    const isPending = receiptData.invoiceNumber.startsWith('PENDING')
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.receiptScroll}>
          <View style={styles.receiptCard}>
            <Text style={styles.receiptIcon}>{isPending ? '⏳' : '✅'}</Text>
            <Text style={styles.receiptTitle}>{isPending ? 'Sale Queued' : 'Sale Complete!'}</Text>
            {isPending && (
              <Text style={styles.receiptSub}>You're offline. This sale will sync when connected.</Text>
            )}
            <Text style={styles.receiptInvNum}>
              {isPending ? 'Will be assigned an invoice number on sync' : receiptData.invoiceNumber}
            </Text>

            <View style={styles.receiptItems}>
              {receiptData.items.map(item => (
                <View key={item.product.id} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>{item.product.name} × {item.qty}</Text>
                  <Text style={styles.receiptItemAmount}>{formatUGX(item.product.sell_price * item.qty)}</Text>
                </View>
              ))}
              <View style={styles.receiptTotal}>
                <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                <Text style={styles.receiptTotalValue}>{formatUGX(receiptData.total)}</Text>
              </View>
            </View>

            <Text style={styles.receiptMethod}>
              {receiptData.paymentType === 'cash'
                ? `Paid via ${receiptData.accountName}`
                : `Charged to ${selectedCustomer?.name ?? 'Customer'}'s account`}
            </Text>

            <TouchableOpacity style={styles.newSaleBtn} onPress={() => setReceiptData(null)}>
              <Text style={styles.newSaleBtnText}>New Sale</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Main POS ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Offline — sales will sync when connected</Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Product grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={p => p.id}
        numColumns={2}
        contentContainerStyle={styles.productGrid}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)}>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            {item.category && <Text style={styles.productCat}>{item.category}</Text>}
            <Text style={styles.productPrice}>{formatUGX(item.sell_price)}</Text>
            <Text style={[styles.productStock, item.stock_qty <= item.low_stock_threshold && styles.stockLow]}>
              {item.stock_qty} in stock
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No products found{!isOnline ? ' (offline data)' : ''}</Text>
        }
      />

      {/* Cart FAB */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartFab} onPress={() => setCartOpen(true)}>
          <Text style={styles.cartFabText}>🛒 {cartCount} item{cartCount > 1 ? 's' : ''} · {formatUGX(cartTotal)}</Text>
          <Text style={styles.cartFabArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Cart modal */}
      <Modal visible={cartOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={styles.cartHeader}>
            <TouchableOpacity onPress={() => setCartOpen(false)}>
              <Text style={styles.cartClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.cartTitle}>Cart</Text>
            <Text style={styles.cartHeaderTotal}>{formatUGX(cartTotal)}</Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            {/* Items */}
            <View style={styles.cartCard}>
              {cart.map(item => (
                <View key={item.product.id} style={styles.cartItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    <Text style={styles.cartItemPrice}>{formatUGX(item.product.sell_price)} each</Text>
                  </View>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product.id, -1)}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyNum}>{item.qty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product.id, 1)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cartItemTotal}>{formatUGX(item.product.sell_price * item.qty)}</Text>
                </View>
              ))}
            </View>

            {/* Payment type */}
            <Text style={styles.sectionLabel}>Payment Type</Text>
            <View style={styles.segControl}>
              {(['cash', 'credit'] as PaymentType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segBtn, paymentType === t && styles.segBtnActive]}
                  onPress={() => { setPaymentType(t); if (t === 'cash') { setSelectedCustomer(null); setCustomerSearch('') } }}
                >
                  <Text style={[styles.segBtnText, paymentType === t && styles.segBtnTextActive]}>
                    {t === 'cash' ? '💵 Cash' : '📋 Credit'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Account selector */}
            {paymentType === 'cash' && accounts.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Paying Account</Text>
                <View style={styles.accountList}>
                  {accounts.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.accountBtn, selectedAccountId === acc.id && styles.accountBtnActive]}
                      onPress={() => setSelectedAccountId(acc.id)}
                    >
                      <Text style={[styles.accountBtnText, selectedAccountId === acc.id && styles.accountBtnTextActive]}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Customer search for credit */}
            {paymentType === 'credit' && (
              <>
                <Text style={styles.sectionLabel}>Customer</Text>
                <TextInput
                  style={styles.custInput}
                  placeholder="Search customer…"
                  placeholderTextColor="#94a3b8"
                  value={customerSearch}
                  onChangeText={t => { setCustomerSearch(t); if (selectedCustomer) setSelectedCustomer(null) }}
                />
                {customerSearch && !selectedCustomer && filteredCustomers.slice(0, 5).map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.custRow}
                    onPress={() => { setSelectedCustomer(c); setCustomerSearch(c.name) }}
                  >
                    <Text style={styles.custName}>{c.name}</Text>
                    <Text style={styles.custPhone}>{c.phone}</Text>
                  </TouchableOpacity>
                ))}
                {selectedCustomer && (
                  <View style={styles.custSelected}>
                    <Text style={styles.custSelectedName}>{selectedCustomer.name}</Text>
                    <Text style={styles.custSelectedBalance}>Balance: {formatUGX(selectedCustomer.credit_balance)}</Text>
                    <TouchableOpacity onPress={() => { setSelectedCustomer(null); setCustomerSearch('') }}>
                      <Text style={styles.custClear}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Note */}
            <Text style={styles.sectionLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note…"
              placeholderTextColor="#94a3b8"
              value={note}
              onChangeText={setNote}
            />
          </ScrollView>

          {/* Checkout button */}
          <View style={styles.checkoutFooter}>
            <TouchableOpacity
              style={[styles.checkoutBtn, submitting && styles.checkoutBtnDisabled]}
              onPress={handleCheckout}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.checkoutBtnText}>
                    {isOnline ? `Confirm · ${formatUGX(cartTotal)}` : `Queue Offline · ${formatUGX(cartTotal)}`}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  offlineBanner: { backgroundColor: '#fef3c7', paddingVertical: 7, paddingHorizontal: 16 },
  offlineText: { color: '#92400e', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  searchBar: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  productGrid: { paddingHorizontal: 12, paddingBottom: 120 },
  productCard: { flex: 1, margin: 4, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  productName: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  productCat: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  productPrice: { fontSize: 15, fontWeight: '800', color: '#059669' },
  productStock: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  stockLow: { color: '#dc2626' },
  empty: { textAlign: 'center', color: '#94a3b8', paddingTop: 48, fontSize: 14 },
  cartFab: { position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#059669', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  cartFabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cartFabArrow: { color: '#fff', fontSize: 18 },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  cartClose: { fontSize: 18, color: '#64748b', width: 32 },
  cartTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cartHeaderTotal: { fontSize: 15, fontWeight: '800', color: '#059669', width: 80, textAlign: 'right' },
  cartCard: { backgroundColor: '#fff', borderRadius: 16, padding: 4, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  cartItemPrice: { fontSize: 12, color: '#64748b', marginTop: 1 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  qtyNum: { fontSize: 15, fontWeight: '700', color: '#0f172a', minWidth: 20, textAlign: 'center' },
  cartItemTotal: { fontSize: 14, fontWeight: '700', color: '#0f172a', minWidth: 80, textAlign: 'right' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  segControl: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  segBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segBtnTextActive: { color: '#0f172a' },
  accountList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  accountBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  accountBtnActive: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  accountBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  accountBtnTextActive: { color: '#059669' },
  custInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  custRow: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: '#f1f5f9' },
  custName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  custPhone: { fontSize: 12, color: '#64748b' },
  custSelected: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderRadius: 10, padding: 12, gap: 8 },
  custSelectedName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#059669' },
  custSelectedBalance: { fontSize: 12, color: '#64748b' },
  custClear: { fontSize: 18, color: '#94a3b8' },
  noteInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  checkoutFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  checkoutBtn: { backgroundColor: '#059669', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  checkoutBtnDisabled: { opacity: 0.6 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Receipt styles
  receiptScroll: { padding: 24, alignItems: 'center' },
  receiptCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  receiptIcon: { fontSize: 48, marginBottom: 12 },
  receiptTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  receiptSub: { fontSize: 13, color: '#f59e0b', textAlign: 'center', marginBottom: 8 },
  receiptInvNum: { fontSize: 15, fontWeight: '700', color: '#059669', marginBottom: 20 },
  receiptItems: { width: '100%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16 },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  receiptItemName: { fontSize: 13, color: '#334155' },
  receiptItemAmount: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  receiptTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  receiptTotalLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  receiptTotalValue: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  receiptMethod: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  newSaleBtn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  newSaleBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
