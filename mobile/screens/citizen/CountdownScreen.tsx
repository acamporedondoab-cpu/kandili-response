import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { getCurrentLocation, getBarangay } from '../../lib/location'
import { supabase } from '../../lib/supabase/client'
import type { EmergencyType } from '../../types'

interface Props {
  emergencyType: EmergencyType
  onDispatched: (incidentId: string) => void
  onCancelled: () => void
}

export default function CountdownScreen({ emergencyType, onDispatched, onCancelled }: Props) {
  const [count, setCount] = useState(3)
  const [dispatching, setDispatching] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => {
    if (count <= 0) {
      handleDispatch()
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    const timer = setTimeout(() => {
      if (!cancelled.current) setCount((c) => c - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [count])

  async function handleDispatch() {
    if (cancelled.current) return
    setDispatching(true)

    const location = await getCurrentLocation()
    if (cancelled.current) return

    if (!location) {
      Alert.alert(
        'Location Required',
        'Unable to get your location. Please enable location permissions and try again.',
        [{ text: 'OK', onPress: onCancelled }]
      )
      return
    }

    // Fetch auth token and barangay in parallel — barangay has 2s timeout
    // If barangay times out, dispatch proceeds and falls back to distance matching
    const [{ data: sessionData }, barangay] = await Promise.all([
      supabase.auth.getSession(),
      Promise.race([
        getBarangay(location.lat, location.lng),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]),
    ])

    const token = sessionData.session?.access_token
    if (!token || cancelled.current) {
      onCancelled()
      return
    }

    const { data, error } = await supabase.functions.invoke('dispatch-sos', {
      body: {
        lat: location.lat,
        lng: location.lng,
        emergency_type: emergencyType,
        barangay: barangay ?? undefined,
      },
    })

    if (cancelled.current) return

    if (error) {
      const status = error.context?.status
      let body: Record<string, unknown> = {}
      try {
        if (error.context) body = await error.context.json()
      } catch { /* ignore parse error */ }

      // 409 = duplicate incident, navigate to existing one
      if (status === 409 && typeof body.incident_id === 'string') {
        onDispatched(body.incident_id)
        return
      }

      const backendMessage =
        typeof body.error === 'string'
          ? body.error
          : error.message ?? 'Could not reach emergency services. Try again.'

      Alert.alert('Dispatch Failed', backendMessage)
      setDispatching(false)
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onDispatched(data.incident_id)
  }

  function handleCancel() {
    cancelled.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCancelled()
  }

  if (dispatching) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" style={{ marginBottom: 16 }} />
        <Text style={styles.dispatchingText}>Contacting emergency services...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Sending SOS in</Text>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.type}>{emergencyType.toUpperCase()} EMERGENCY</Text>

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelText}>CANCEL</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#9ca3af',
    fontSize: 18,
    marginBottom: 16,
  },
  count: {
    color: '#DC2626',
    fontSize: 120,
    fontWeight: '900',
    lineHeight: 120,
  },
  type: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 60,
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: '#6b7280',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
  },
  cancelText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dispatchingText: {
    color: '#fff',
    fontSize: 18,
  },
})
