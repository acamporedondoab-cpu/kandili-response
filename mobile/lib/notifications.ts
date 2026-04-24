import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase/client'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(userId: string): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push permission denied')
    return
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Guardian Dispatch',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
    })
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync()
    const fcmToken = tokenData.data

    if (fcmToken) {
      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: fcmToken })
        .eq('id', userId)

      if (error) {
        console.error('[notifications] Failed to save FCM token:', error.message)
      } else {
        console.log('[notifications] FCM token registered')
      }
    }
  } catch (err) {
    console.warn('[notifications] getDevicePushTokenAsync failed (expected in Expo Go):', err)
  }
}
