import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configure how notifications are shown when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(employeeId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[notifications] Push not available on simulator')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push permission denied')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Tunda Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  const token = tokenData.data

  // Upsert token in Supabase
  await supabase.from('device_tokens').upsert({
    employee_id: employeeId,
    token,
    platform: Platform.OS as 'ios' | 'android',
    is_active: true,
  }, { onConflict: 'employee_id,token' })

  return token
}

export async function deregisterToken(employeeId: string) {
  const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null)
  if (!tokenData) return
  await supabase.from('device_tokens')
    .update({ is_active: false })
    .eq('employee_id', employeeId)
    .eq('token', tokenData.data)
}

export function usePushNotificationListener(
  onReceive?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void
) {
  // Returns cleanup functions — attach in useEffect
  const receiveListener = onReceive
    ? Notifications.addNotificationReceivedListener(onReceive)
    : null
  const responseListener = onResponse
    ? Notifications.addNotificationResponseReceivedListener(onResponse)
    : null

  return () => {
    receiveListener?.remove()
    responseListener?.remove()
  }
}
