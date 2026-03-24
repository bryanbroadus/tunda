import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { registerForPushNotifications } from '@/lib/notifications'

export default function NotificationsScreen() {
  const { employee } = useStore()
  const [permStatus, setPermStatus] = useState<string>('unknown')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkPermissions()
  }, [])

  async function checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync()
    setPermStatus(status)
    setEnabled(status === 'granted')
  }

  async function toggleNotifications(value: boolean) {
    if (!employee) return
    setLoading(true)
    if (value) {
      const token = await registerForPushNotifications(employee.id)
      setEnabled(!!token)
      setPermStatus(token ? 'granted' : 'denied')
    } else {
      await supabase.from('device_tokens')
        .update({ is_active: false })
        .eq('employee_id', employee.id)
      setEnabled(false)
    }
    setLoading(false)
  }

  const alerts = [
    { emoji: '📦', title: 'Low Stock Alert', desc: 'When a product drops below its threshold' },
    { emoji: '🧾', title: 'Overdue Invoice', desc: 'When a customer invoice passes its due date' },
    { emoji: '💰', title: 'Large Sale', desc: 'When a sale exceeds UGX 500,000' },
    { emoji: '👤', title: 'New Team Activity', desc: 'When a waiter records a sale' },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Permission card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Push Notifications</Text>
              <Text style={styles.cardDesc}>
                {permStatus === 'granted'
                  ? 'Notifications are enabled for this device.'
                  : permStatus === 'denied'
                    ? 'Permission denied. Enable in device settings.'
                    : 'Enable to receive business alerts on this device.'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleNotifications}
              disabled={loading || permStatus === 'denied'}
              trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
              thumbColor={enabled ? '#059669' : '#94a3b8'}
            />
          </View>
          {permStatus === 'denied' && (
            <View style={styles.deniedBanner}>
              <Text style={styles.deniedText}>
                Go to Settings → Tunda → Notifications to enable them.
              </Text>
            </View>
          )}
        </View>

        {/* Alert types */}
        <Text style={styles.sectionTitle}>What you'll be notified about</Text>
        <View style={styles.card}>
          {alerts.map((a, i) => (
            <View key={a.title} style={[styles.alertRow, i < alerts.length - 1 && styles.alertBorder]}>
              <Text style={styles.alertEmoji}>{a.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{a.title}</Text>
                <Text style={styles.alertDesc}>{a.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Notifications are sent by Tunda servers. No data leaves your Supabase instance.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  deniedBanner: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, marginTop: 12 },
  deniedText: { color: '#dc2626', fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  alertBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  alertEmoji: { fontSize: 22, marginTop: 1 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  alertDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  note: { fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 16 },
})
