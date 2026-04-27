import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import type { Profile, Incident } from '../types'

const { width } = Dimensions.get('window')
const DRAWER_WIDTH = Math.min(width * 0.78, 300)

interface Props {
  visible: boolean
  profile: Profile | null
  activeIncident: Incident | null
  onClose: () => void
  onProfile: () => void
  onHistory: () => void
  onViewIncident: (id: string) => void
  onSignOut: () => void
}

export default function AppDrawer({
  visible,
  profile,
  activeIncident,
  onClose,
  onProfile,
  onHistory,
  onViewIncident,
  onSignOut,
}: Props) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const [isRendered, setIsRendered] = useState(visible)

  useEffect(() => {
    if (visible) {
      setIsRendered(true)
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setIsRendered(false)
      })
    }
  }, [visible])

  const roleLabel = profile?.role === 'citizen'
    ? 'Citizen'
    : profile?.role === 'responder'
    ? 'Responder'
    : profile?.role === 'team_leader'
    ? 'Team Leader'
    : ''

  const avatarLetter = profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'

  const menuItems = [
    { icon: 'user' as const, label: 'Profile', onPress: () => { onClose(); onProfile() } },
    { icon: 'clock' as const, label: 'Incident History', onPress: () => { onClose(); onHistory() } },
  ]

  if (!isRendered) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

          {/* ── Avatar + Name + Role ── */}
          <View style={styles.profileSection}>
            <View style={styles.avatarWrapper}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                </View>
              )}
              <View style={styles.avatarRing} />
            </View>

            <Text style={styles.fullName} numberOfLines={1}>
              {profile?.full_name ?? 'User'}
            </Text>
            <Text style={styles.roleLabel}>{roleLabel}</Text>
          </View>

          {/* ── Active Incident Card (conditional) ── */}
          {activeIncident && (
            <TouchableOpacity
              style={styles.incidentCard}
              onPress={() => { onClose(); onViewIncident(activeIncident.id) }}
              activeOpacity={0.85}
            >
              <View style={styles.incidentCardLeft}>
                <View style={styles.incidentIconBox}>
                  <Feather name="alert-triangle" size={16} color="#FCA5A5" />
                </View>
                <View>
                  <Text style={styles.incidentCardTitle}>Active Incident</Text>
                  <Text style={styles.incidentCardSub}>
                    {activeIncident.incident_code} · {activeIncident.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="rgba(252,165,165,0.6)" />
            </TouchableOpacity>
          )}

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Menu ── */}
          <View style={styles.menu}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconBox}>
                  <Feather name={item.icon} size={18} color="rgba(255,255,255,0.55)" />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Logout ── */}
          <TouchableOpacity style={styles.menuItem} onPress={onSignOut} activeOpacity={0.7}>
            <View style={styles.menuIconBox}>
              <Feather name="log-out" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.menuLabel, styles.logoutLabel]}>Logout</Text>
          </TouchableOpacity>

          {/* ── Brand footer ── */}
          <View style={styles.brand}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brandName}>KANDILI</Text>
              <Text style={styles.brandSub}>RESPONSE</Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,7,18,0.72)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#070B18',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,229,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
  },
  avatarWrapper: {
    width: 84,
    height: 84,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    position: 'absolute',
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(220,38,38,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  avatarRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  fullName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  roleLabel: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  incidentCard: {
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  incidentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  incidentIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(220,38,38,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  incidentCardSub: {
    color: 'rgba(252,165,165,0.7)',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 12,
  },
  menu: {
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 14,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutLabel: {
    color: '#DC2626',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 20,
    paddingBottom: Platform.OS === 'android' ? 16 : 0,
  },
  brandLogo: {
    width: 36,
    height: 36,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
    lineHeight: 16,
  },
  brandSub: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 4,
  },
})
