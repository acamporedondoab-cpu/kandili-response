import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Feather, FontAwesome5 } from '@expo/vector-icons'
import { signOut } from '../../lib/auth'
import type { EmergencyType, Incident, Profile } from '../../types'
import EmergencyTypeModal from '../../components/EmergencyTypeModal'
import AppDrawer from '../../components/AppDrawer'
import { supabase } from '../../lib/supabase/client'
import * as ExpoLocation from 'expo-location'
import { getCurrentLocation, reverseGeocode } from '../../lib/location'
import MediaCaptureModal from '../../components/MediaCaptureModal'
import type { MediaItem } from '../../lib/media'

interface Props {
  userId: string
  profile: Profile | null
  onSosDispatched: (type: EmergencyType, pendingMedia: MediaItem[]) => void
  onGoToActiveIncident: (incidentId: string) => void
  onGoToHistory: () => void
  onGoToProfile: () => void
}

export default function HomeScreen({
  userId,
  profile,
  onSosDispatched,
  onGoToActiveIncident,
  onGoToHistory,
  onGoToProfile,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null)
  const [pendingMedia, setPendingMedia] = useState<MediaItem[]>([])
  const [mediaCaptureVisible, setMediaCaptureVisible] = useState(false)

  // Location card state
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const progress = useRef(new Animated.Value(0)).current
  const holdAnimation = useRef<Animated.CompositeAnimation | null>(null)

  // Idle pulse glow
  const idlePulse = useRef(new Animated.Value(0)).current
  const idlePulseLoop = useRef<Animated.CompositeAnimation | null>(null)

  function startIdlePulse() {
    idlePulse.setValue(0)
    idlePulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(idlePulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    )
    idlePulseLoop.current.start()
  }

  useEffect(() => {
    checkActiveIncident()
    fetchLocation()
    startIdlePulse()
    return () => idlePulseLoop.current?.stop()
  }, [])

  async function checkActiveIncident() {
    const openStatuses = [
      'pending', 'escalated', 'acknowledged', 'assigned',
      'accepted', 'en_route', 'arrived', 'pending_citizen_confirmation',
    ]
    const { data } = await supabase
      .from('incidents')
      .select('id, incident_code, status, emergency_type')
      .eq('citizen_id', userId)
      .in('status', openStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) setActiveIncident(data as Incident)
  }

  const fetchLocation = useCallback(async () => {
    setLocationLoading(true)
    try {
      const loc = await getCurrentLocation()
      if (!loc) {
        setLocationLabel('Location unavailable')
        return
      }
      const label = await reverseGeocode(loc.lat, loc.lng)
      setLocationLabel(label ?? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`)
      setLocationAccuracy(null)

      // Get accuracy from last known position
      const pos = await ExpoLocation.getLastKnownPositionAsync()
      if (pos?.coords.accuracy) {
        setLocationAccuracy(Math.round(pos.coords.accuracy))
      }
    } catch {
      setLocationLabel('Location unavailable')
    } finally {
      setLocationLoading(false)
    }
  }, [])

  function handleCall911() {
    Alert.alert(
      'Call 911',
      'This will connect you directly to emergency services.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:911'),
        },
      ]
    )
  }

  function handlePressIn() {
    if (activeIncident) {
      onGoToActiveIncident(activeIncident.id)
      return
    }
    idlePulseLoop.current?.stop()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    holdAnimation.current = Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    })
    holdAnimation.current.start(({ finished }) => {
      if (finished) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setModalVisible(true)
        progress.setValue(0)
        startIdlePulse()
      }
    })
  }

  function handlePressOut() {
    holdAnimation.current?.stop()
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => startIdlePulse())
  }

  function handleTypeSelected(type: EmergencyType) {
    setModalVisible(false)
    onSosDispatched(type, pendingMedia)
    setPendingMedia([])
  }

  function handleSignOut() {
    setDrawerOpen(false)
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut()
          } catch (e) {
            console.error('[HomeScreen] signOut error:', e)
          }
        },
      },
    ])
  }

  const buttonScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.95],
  })

  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.4, 1],
  })

  const ringScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  })

  const idleRingScale = idlePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] })
  const idleRingOpacity = idlePulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.5, 0.2] })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setDrawerOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="menu" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerBrand}>
          <Text style={styles.headerBrandName}>KANDILI</Text>
          <Text style={styles.headerBrandSub}>RESPONSE</Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {}}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="bell" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {/* ── Location Card ── */}
      <View style={styles.locationCard}>
        <View style={styles.locationLeft}>
          <Feather name="map-pin" size={16} color="#DC2626" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <Text style={styles.locationCity} numberOfLines={1}>
              {locationLoading ? 'Locating...' : (locationLabel ?? 'Tap refresh to locate')}
            </Text>
            {locationAccuracy !== null && (
              <Text style={styles.locationAccuracy}>Accuracy: {locationAccuracy}m</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.locationRefresh}
          onPress={fetchLocation}
          disabled={locationLoading}
        >
          <Feather
            name="refresh-cw"
            size={16}
            color={locationLoading ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'}
          />
        </TouchableOpacity>
      </View>

      {/* ── Active Incident Banner ── */}
      {activeIncident && (
        <TouchableOpacity
          style={styles.activeIncidentBanner}
          onPress={() => onGoToActiveIncident(activeIncident.id)}
        >
          <Feather name="alert-triangle" size={16} color="#FCA5A5" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeIncidentText}>
              Active Incident: {activeIncident.incident_code}
            </Text>
            <Text style={styles.activeIncidentSub}>
              {activeIncident.status.replace(/_/g, ' ').toUpperCase()} — tap to view
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color="rgba(252,165,165,0.6)" />
        </TouchableOpacity>
      )}

      {/* ── SOS Button ── */}
      <View style={styles.center}>
        <Text style={styles.instruction}>HOLD FOR 2 SECONDS{'\n'}TO ACTIVATE SOS</Text>

        <View style={styles.buttonWrapper}>
          {/* Wide ambient glow — the red halo radiating behind everything */}
          <View style={styles.ambientGlow} />

          {/* Outer ripple ring — static faint */}
          <View style={styles.rippleOuter} />

          {/* Inner ripple ring — animated idle pulse */}
          <Animated.View
            style={[styles.rippleInner, {
              opacity: idleRingOpacity,
              transform: [{ scale: idleRingScale }],
            }]}
          />

          {/* Hold-progress ring — expands on press */}
          <Animated.View
            style={[styles.holdRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          />

          {/* Dark bezel — the thick black ring between glow and button */}
          <LinearGradient
            colors={['#1c0404', '#040000']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.bezel}
          >
            {/* Bezel inner rim — red lip where bezel meets button */}
            <View style={styles.bezelRim}>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
                  {/* Dome button — bright top, dark bottom via gradient */}
                  <LinearGradient
                    colors={activeIncident
                      ? ['#cc0000', '#8b0000', '#550000', '#300000']
                      : ['#ff6060', '#ee1a1a', '#cc0000', '#800000']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.innerButton}
                  >
                    <Text style={styles.sosText}>SOS</Text>
                    {activeIncident && <Text style={styles.sosSubText}>TAP TO VIEW</Text>}
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </View>
          </LinearGradient>
        </View>

        {!activeIncident && (
          <Text style={styles.hint}>Hold button to activate emergency alert</Text>
        )}
      </View>

      {/* ── Bottom Actions: PHOTO / VIDEO / CALL 911 ── */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionTile} activeOpacity={0.75} onPress={() => setMediaCaptureVisible(true)}>
          <View style={{ position: 'relative' }}>
            <Feather name="camera" size={26} color="rgba(255,255,255,0.75)" />
            {pendingMedia.length > 0 && (
              <View style={styles.mediaBadge}>
                <Text style={styles.mediaBadgeText}>{pendingMedia.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.actionLabel}>PHOTO / VIDEO</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionTile, styles.call911Tile]} activeOpacity={0.75} onPress={handleCall911}>
          <View style={styles.noInternetBadge}>
            <Text style={styles.noInternetText}>No Internet?</Text>
          </View>
          <FontAwesome5 name="phone-alt" size={22} color="#DC2626" />
          <Text style={[styles.actionLabel, styles.call911Label]}>CALL 911</Text>
        </TouchableOpacity>
      </View>

      {/* ── No Internet Notice ── */}
      <TouchableOpacity style={styles.noInternetCard} onPress={handleCall911} activeOpacity={0.75}>
        <Feather name="wifi-off" size={18} color="#DC2626" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.noInternetCardTitle}>No internet connection?</Text>
          <Text style={styles.noInternetCardSub}>Tap to call 911 directly.</Text>
        </View>
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>

      {/* ── Media Capture Modal ── */}
      <MediaCaptureModal
        visible={mediaCaptureVisible}
        onConfirm={(item) => {
          setPendingMedia((prev) => [...prev, item])
          setMediaCaptureVisible(false)
        }}
        onCancel={() => setMediaCaptureVisible(false)}
      />

      {/* ── Emergency Type Modal ── */}
      <EmergencyTypeModal
        visible={modalVisible}
        onSelect={handleTypeSelected}
        onCancel={() => {
          setModalVisible(false)
          progress.setValue(0)
          startIdlePulse()
        }}
      />

      {/* ── Drawer ── */}
      <AppDrawer
        visible={drawerOpen}
        profile={profile}
        activeIncident={activeIncident}
        onClose={() => setDrawerOpen(false)}
        onProfile={onGoToProfile}
        onHistory={onGoToHistory}
        onViewIncident={onGoToActiveIncident}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B18',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    alignItems: 'center',
  },
  headerBrandName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 5,
    lineHeight: 18,
  },
  headerBrandSub: {
    color: '#DC2626',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 5,
    lineHeight: 12,
  },

  // Location card
  locationCard: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },
  locationCity: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  locationAccuracy: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  locationRefresh: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active incident banner
  activeIncidentBanner: {
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeIncidentText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  activeIncidentSub: {
    color: '#fca5a5',
    fontSize: 11,
    marginTop: 2,
  },

  // SOS
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instruction: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  buttonWrapper: {
    width: 340,
    height: 340,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Wide red halo — radiates behind entire assembly
  ambientGlow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'transparent',
    shadowColor: '#cc0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 0,
  },
  // Static outer ripple
  rippleOuter: {
    position: 'absolute',
    width: 318,
    height: 318,
    borderRadius: 159,
    borderWidth: 1,
    borderColor: 'rgba(255, 30, 30, 0.18)',
  },
  // Animated inner ripple
  rippleInner: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    borderColor: 'rgba(255, 30, 30, 0.35)',
  },
  // Hold-progress ring
  holdRing: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 2.5,
    borderColor: '#ff2222',
  },
  // Thick dark bezel — must be clearly visible between glow and button
  bezel: {
    width: 256,
    height: 256,
    borderRadius: 128,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 16,
  },
  // Subtle red inner lip where bezel meets button
  bezelRim: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(160, 10, 10, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Dome button — no inner shadow overlay; gradient alone gives depth
  innerButton: {
    width: 210,
    height: 210,
    borderRadius: 105,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sosText: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sosSubText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  hint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    marginTop: 32,
    letterSpacing: 1,
  },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionTile: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  call911Tile: {
    position: 'relative',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  call911Label: {
    color: '#DC2626',
  },
  actionDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 14,
  },
  noInternetBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#DC2626',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  noInternetText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  mediaBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  mediaBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },

  // No internet card
  noInternetCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noInternetCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  noInternetCardSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
})
