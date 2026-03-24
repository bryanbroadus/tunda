import { Tabs } from 'expo-router'
import { useStore } from '@/lib/store'
import { View, Text, StyleSheet } from 'react-native'

function SyncDot() {
  const { isSyncing, isOnline, pendingCount } = useStore()
  if (!isOnline) {
    return <View style={dot.offline}><Text style={dot.label}>✗</Text></View>
  }
  if (isSyncing) {
    return <View style={dot.syncing}><Text style={dot.label}>↻</Text></View>
  }
  if (pendingCount > 0) {
    return <View style={dot.pending}><Text style={dot.count}>{pendingCount}</Text></View>
  }
  return null
}

const dot = StyleSheet.create({
  offline: { position: 'absolute', top: -2, right: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  syncing: { position: 'absolute', top: -2, right: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  pending: { position: 'absolute', top: -2, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  label: { color: '#fff', fontSize: 9, fontWeight: '700' },
  count: { color: '#fff', fontSize: 9, fontWeight: '700' },
})

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#0f172a',
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} />,
          headerRight: () => <SyncDot />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color }) => <TabIcon emoji="🔔" color={color} />,
        }}
      />
    </Tabs>
  )
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 22, opacity: color === '#059669' ? 1 : 0.5 }}>{emoji}</Text>
  )
}
