import 'react-native-url-polyfill/auto'
import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { AppState, AppStateStatus } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import * as Network from 'expo-network'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { fullSync } from '@/lib/offline/sync'
import { registerForPushNotifications } from '@/lib/notifications'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { setAuth, clearAuth, setOnline, setIsSyncing, setLastSyncedAt, employee, isOnline } = useStore()
  const appState = useRef(AppState.currentState)

  // Bootstrap auth + sync on mount
  useEffect(() => {
    bootstrapAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAuth()
        router.replace('/(auth)/login')
        return
      }
      if (event === 'SIGNED_IN' && session) {
        await loadUserData(session.user.id)
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  // Monitor network and sync when coming back online
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange)
    checkNetwork()
    return () => subscription.remove()
  }, [employee])

  async function bootstrapAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await loadUserData(session.user.id)
      } else {
        router.replace('/(auth)/login')
      }
    } catch {
      router.replace('/(auth)/login')
    } finally {
      SplashScreen.hideAsync()
    }
  }

  async function loadUserData(userId: string) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id, business_id, role, user_id, businesses(id, name, business_phone, business_address, receipt_template, receipt_footer)')
      .eq('user_id', userId)
      .single()

    if (!emp) {
      clearAuth()
      router.replace('/(auth)/login')
      return
    }

    const biz = emp.businesses as any
    setAuth(
      { id: userId, email: undefined },
      { id: emp.id, business_id: emp.business_id, user_id: emp.user_id, role: emp.role as any },
      biz ? { id: biz.id, name: biz.name, business_phone: biz.business_phone, business_address: biz.business_address, receipt_template: biz.receipt_template ?? 1, receipt_footer: biz.receipt_footer } : null
    )

    // Register push token for owners
    if (emp.role === 'owner' || emp.role === 'manager') {
      registerForPushNotifications(emp.id).catch(console.warn)
    }

    // Route based on role
    const role = emp.role
    if (role === 'owner' || role === 'manager') {
      router.replace('/(owner)/')
    } else {
      router.replace('/(waiter)/pos')
    }

    // Initial sync
    doSync(emp.business_id)
  }

  async function checkNetwork() {
    const state = await Network.getNetworkStateAsync()
    setOnline(!!state.isConnected && !!state.isInternetReachable)
  }

  async function handleAppStateChange(nextState: AppStateStatus) {
    const wasBackground = appState.current.match(/inactive|background/)
    appState.current = nextState

    if (nextState === 'active' && wasBackground && employee) {
      await checkNetwork()
      if (isOnline) {
        doSync(employee.business_id)
      }
    }
  }

  async function doSync(businessId: string) {
    setIsSyncing(true)
    try {
      await fullSync(businessId)
      setLastSyncedAt(new Date().toISOString())
    } catch (e) {
      console.warn('[sync] Error:', e)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(owner)" />
      <Stack.Screen name="(waiter)" />
    </Stack>
  )
}
