import { Tabs } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'
import { useStore } from '@/lib/store'

function OfflineBadge() {
  const { isOnline, pendingCount } = useStore()
  if (isOnline && pendingCount === 0) return null
  return (
    <View style={badge.wrap}>
      <Text style={badge.text}>{!isOnline ? '✗' : String(pendingCount)}</Text>
    </View>
  )
}

const badge = StyleSheet.create({
  wrap: { position: 'absolute', top: -3, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  text: { color: '#fff', fontSize: 9, fontWeight: '800' },
})

export default function WaiterLayout() {
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
        name="pos"
        options={{
          title: 'Point of Sale',
          tabBarLabel: 'POS',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🛒</Text>
              {focused && <OfflineBadge />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarLabel: 'Invoices',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🧾</Text>
          ),
        }}
      />
    </Tabs>
  )
}
