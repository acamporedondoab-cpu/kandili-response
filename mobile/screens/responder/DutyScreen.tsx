import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase/client'
import { signOut } from '../../lib/auth'
import type { Profile, Incident } from '../../types'

interface Props {
  userId: string
  onOpenIncident: (incidentId: string) => void
  onGoToHistory: () => void
  onGoToProfile: () => void
}

export default function DutyScreen({ userId, onOpenIncident, onGoToHistory, onGoToProfile }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null)
  const [toggling, setToggling] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const slideAnim = useRef(new Animated.Value(-300)).current
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

  function openSidebar() {
    setSidebarOpen(true)
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start()
  }

  function closeSidebar(then?: () => void) {
    Animated.timing(slideAnim, {
      toValue: -300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSidebarOpen(false)
      then?.()
    })
  }

  useEffect(() => {
    fetchProfile()
    fetchActiveIncident()

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

  useEffect(() => {
    if (profile?.is_on_duty) {
      startLocationTracking()
    }
  }, [profile?.id])

  useEffect(() => {
    if (profile?.organization_id) {
      fetchOrgName(profile.organization_id)
    }
  }, [profile?.organization_id])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_on_duty, organization_id, is_suspended, fcm_token, abuse_strike_count, created_at, updated_at, phone_number, phone_verified, email, avatar_url')
      .eq('id', userId)
      .single()
    if (data) setProfile(data as Profile)
  }

  async function fetchOrgName(orgId: string) {
    const { data } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', orgId)
      .single()
    if (data) {
      const org = data as { name: string; logo_url: string | null }
      setOrgName(org.name)
      setOrgLogoUrl(org.logo_url ?? null)
    }
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

  const avatarLetter = (profile.full_name ?? 'R').charAt(0).toUpperCase()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburger} onPress={openSidebar} activeOpacity={0.7}>
          <Feather name="menu" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.orgRow}>
            {orgLogoUrl ? (
              <Image source={{ uri: orgLogoUrl }} style={styles.orgLogoImage} />
            ) : orgName ? (
              <View style={styles.orgLogoBadge}>
                <Text style={styles.orgLogoLetter}>{orgName.charAt(0).toUpperCase()}</Text>
              </View>
            ) : null}
            <Text style={styles.appName} numberOfLines={1}>
              {orgName ?? 'Guardian Dispatch'}
            </Text>
          </View>
          <Text style={styles.roleLabel}>RESPONDER</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Greeting */}
        {profile.full_name && (
          <Text style={styles.greeting}>Hello, {profile.full_name}</Text>
        )}

        {/* Duty toggle card */}
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
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(220,38,38,0.6)' }}
                thumbColor={profile.is_on_duty ? '#DC2626' : 'rgba(255,255,255,0.4)'}
              />
            )}
          </View>
          {!profile.is_on_duty && (
            <Text style={styles.dutyHint}>Toggle on to receive incident assignments</Text>
          )}
        </View>

        {/* Active incident or standby */}
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
              Status: {activeIncident.status.replace(/_/g, ' ').toUpperCase()}
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
            <View style={styles.standbyIconWrap}>
              <Feather name="radio" size={36} color="rgba(99,102,241,0.8)" />
            </View>
            <Text style={styles.standbyText}>Standing by</Text>
            <Text style={styles.standbySub}>
              {profile.is_on_duty
                ? 'No active assignments. You will be notified when dispatched.'
                : 'Go on duty to receive assignments.'}
            </Text>
          </View>
        )}
      </View>

      {/* Sidebar */}
      {sidebarOpen && (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => closeSidebar()}>
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => closeSidebar()}
          >
            <Animated.View
              style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
            >
              <TouchableOpacity activeOpacity={1} style={{ flex: 1 }}>
                <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

                  {/* User info */}
                  <View style={styles.sidebarUser}>
                    {profile.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.sidebarAvatar} />
                    ) : (
                      <View style={styles.sidebarAvatarPlaceholder}>
                        <Text style={styles.sidebarAvatarLetter}>{avatarLetter}</Text>
                      </View>
                    )}
                    <Text style={styles.sidebarName} numberOfLines={2}>
                      {profile.full_name ?? 'Responder'}
                    </Text>
                    <View style={styles.sidebarRoleBadge}>
                      <Text style={styles.sidebarRoleText}>RESPONDER</Text>
                    </View>
                    {orgName && (
                      <Text style={styles.sidebarOrg}>{orgName}</Text>
                    )}
                  </View>

                  <View style={styles.sidebarDivider} />

                  {/* Nav items */}
                  <View style={styles.sidebarNav}>
                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={() => closeSidebar(onGoToProfile)}
                    >
                      <Feather name="user" size={18} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.sidebarItemText}>Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.sidebarItem}
                      onPress={() => closeSidebar(onGoToHistory)}
                    >
                      <Feather name="clock" size={18} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.sidebarItemText}>History</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sidebarDivider} />

                  <TouchableOpacity
                    style={[styles.sidebarItem, styles.sidebarSignOut]}
                    onPress={() => closeSidebar(signOut)}
                  >
                    <Feather name="log-out" size={18} color="#ef4444" />
                    <Text style={[styles.sidebarItemText, { color: '#ef4444' }]}>Sign Out</Text>
                  </TouchableOpacity>

                </SafeAreaView>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  hamburger: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  roleLabel: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orgLogoImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  orgLogoBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(220,38,38,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogoLetter: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  greeting: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginBottom: 20,
  },
  dutyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dutyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dutyLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  dutyStatus: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dutyHint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    marginTop: 10,
  },
  incidentCard: {
    backgroundColor: 'rgba(220,38,38,0.05)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.5)',
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
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 6,
  },
  incidentAddress: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    marginBottom: 10,
  },
  incidentCta: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  standbyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  standbyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  standbyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  standbySub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Sidebar
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    height: '100%',
    backgroundColor: '#0D1224',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
  },
  sidebarUser: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  sidebarAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 14,
  },
  sidebarAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderWidth: 2,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sidebarAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  sidebarName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
    textAlign: 'center',
  },
  sidebarRoleBadge: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 10,
  },
  sidebarRoleText: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sidebarOrg: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 24,
    marginVertical: 8,
  },
  sidebarNav: {
    paddingTop: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 14,
  },
  sidebarItemText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '500',
  },
  sidebarSignOut: {
    marginTop: 8,
  },
})
