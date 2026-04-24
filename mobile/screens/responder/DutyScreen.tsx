import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase/client'
import { signOut } from '../../lib/auth'
import type { Profile, Incident } from '../../types'

interface Props {
  userId: string
  onOpenIncident: (incidentId: string) => void
  onGoToHistory: () => void
}

export default function DutyScreen({ userId, onOpenIncident, onGoToHistory }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null)
  const [toggling, setToggling] = useState(false)
  const locationWatcher = useRef<Location.LocationSubscription | null>(null)

  async function startLocationTracking() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return

    locationWatcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
      async (loc) => {
        await supabase
          .from('profiles')
          .update({ last_known_lat: loc.coords.latitude, last_known_lng: loc.coords.longitude })
          .eq('id', userId)
      }
    )
  }

  function stopLocationTracking() {
    locationWatcher.current?.remove()
    locationWatcher.current = null
  }

  useEffect(() => {
    fetchProfile()
    fetchActiveIncident()

    // Realtime: listen for new assignments
    const channel = supabase
      .channel(`responder:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `assigned_responder_id=eq.${userId}`,
        },
        () => {
          fetchActiveIncident()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      stopLocationTracking()
    }
  }, [userId])

  // Start tracking if already on duty when screen mounts
  useEffect(() => {
    if (profile?.is_on_duty) {
      startLocationTracking()
    }
  }, [profile?.id])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_on_duty, organization_id, is_suspended, fcm_token, abuse_strike_count, created_at, updated_at')
      .eq('id', userId)
      .single()
    if (data) setProfile(data as Profile)
  }

  async function fetchActiveIncident() {
    const activeStatuses = ['assigned', 'accepted', 'en_route', 'arrived', 'pending_citizen_confirmation']
    const { data } = await supabase
      .from('incidents')
      .select('id, incident_code, status, emergency_type, citizen_address, citizen_lat, citizen_lng')
      .eq('assigned_responder_id', userId)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setActiveIncident(data ? (data as Incident) : null)
  }

  async function handleDutyToggle(value: boolean) {
    if (activeIncident && !value) {
      Alert.alert('Cannot go off duty', 'You have an active incident. Resolve it first.')
      return
    }

    setToggling(true)

    const updatePayload: Record<string, unknown> = { is_on_duty: value }

    if (value) {
      // Grab current position immediately so TL sees it right away
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          updatePayload.last_known_lat = loc.coords.latitude
          updatePayload.last_known_lng = loc.coords.longitude
        } catch (_) {}
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)

    if (error) {
      Alert.alert('Error', 'Failed to update duty status')
    } else {
      setProfile((prev) => prev ? { ...prev, is_on_duty: value } : prev)
      if (value) {
        startLocationTracking()
      } else {
        stopLocationTracking()
      }
    }
    setToggling(false)
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Guardian Dispatch</Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={onGoToHistory}>
            <Text style={styles.historyLink}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.logout}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.greeting}>
          {profile.full_name ? `Hello, ${profile.full_name.split(' ')[0]}` : 'Responder'}
        </Text>

        <View style={styles.dutyCard}>
          <View style={styles.dutyRow}>
            <View>
              <Text style={styles.dutyLabel}>Duty Status</Text>
              <Text style={[styles.dutyStatus, { color: profile.is_on_duty ? '#10b981' : '#6b7280' }]}>
                {profile.is_on_duty ? 'ON DUTY' : 'OFF DUTY'}
              </Text>
            </View>
            {toggling ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <Switch
                value={profile.is_on_duty}
                onValueChange={handleDutyToggle}
                trackColor={{ false: '#374151', true: '#dc2626' }}
                thumbColor="#fff"
              />
            )}
          </View>
          {!profile.is_on_duty && (
            <Text style={styles.dutyHint}>Toggle on to receive incident assignments</Text>
          )}
        </View>

        {activeIncident ? (
          <TouchableOpacity
            style={styles.incidentCard}
            onPress={() => onOpenIncident(activeIncident.id)}
          >
            <View style={styles.incidentHeader}>
              <Text style={styles.incidentBadge}>ACTIVE</Text>
              <Text style={styles.incidentCode}>{activeIncident.incident_code}</Text>
            </View>
            <Text style={styles.incidentType}>
              {activeIncident.emergency_type === 'crime' ? '🚔 Crime' : '🚑 Medical'}
            </Text>
            <Text style={styles.incidentStatus}>
              Status: {activeIncident.status.replace('_', ' ').toUpperCase()}
            </Text>
            {activeIncident.citizen_address && (
              <Text style={styles.incidentAddress} numberOfLines={2}>
                {activeIncident.citizen_address}
              </Text>
            )}
            <Text style={styles.incidentCta}>Tap to open incident →</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.standbyCard}>
            <Text style={styles.standbyIcon}>📡</Text>
            <Text style={styles.standbyText}>Standing by</Text>
            <Text style={styles.standbySub}>
              {profile.is_on_duty
                ? 'No active assignments. You will be notified when dispatched.'
                : 'Go on duty to receive assignments.'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  appName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  logout: {
    color: '#6b7280',
    fontSize: 14,
  },
  historyLink: {
    color: '#6b7280',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  greeting: {
    color: '#9ca3af',
    fontSize: 15,
    marginBottom: 20,
  },
  dutyCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dutyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dutyLabel: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 4,
  },
  dutyStatus: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dutyHint: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 10,
  },
  incidentCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  incidentBadge: {
    backgroundColor: '#DC2626',
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 1,
  },
  incidentCode: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  incidentType: {
    color: '#e5e7eb',
    fontSize: 15,
    marginBottom: 6,
  },
  incidentStatus: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 6,
  },
  incidentAddress: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 10,
  },
  incidentCta: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  standbyCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  standbyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  standbyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  standbySub: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
})
