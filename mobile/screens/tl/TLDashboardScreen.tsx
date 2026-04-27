import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase/client'
import { signOut } from '../../lib/auth'
import type { Incident, IncidentStatus, Profile } from '../../types'

interface Props {
  userId: string
  orgId: string
  profile: Profile | null
  onOpenIncident: (incidentId: string) => void
  onGoToHistory: () => void
  onGoToProfile: () => void
}

const ACTIVE_STATUSES: IncidentStatus[] = [
  'pending',
  'escalated',
  'acknowledged',
  'assigned',
  'accepted',
  'en_route',
  'arrived',
  'pending_citizen_confirmation',
]

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  escalated: '#ef4444',
  acknowledged: '#3b82f6',
  assigned: '#8b5cf6',
  accepted: '#06b6d4',
  en_route: '#10b981',
  arrived: '#10b981',
  pending_citizen_confirmation: '#f59e0b',
}

function getElapsed(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function TLDashboardScreen({ userId, orgId, profile, onOpenIncident, onGoToHistory, onGoToProfile }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const slideAnim = useRef(new Animated.Value(-300)).current

  // Re-fetch every time this screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      fetchIncidents()
    }, [orgId])
  )

  useEffect(() => {
    fetchIncidents()
    fetchOrgName()

    const channel = supabase
      .channel(`tl-org:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `organization_id=eq.${orgId}`,
        },
        () => fetchIncidents()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId])

  async function fetchIncidents() {
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })

    setIncidents(data ? (data as Incident[]) : [])
    setLoading(false)
  }

  async function fetchOrgName() {
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

  function renderIncident({ item }: { item: Incident }) {
    const color = STATUS_COLOR[item.status] ?? '#6b7280'
    const needsAction = item.status === 'pending' || item.status === 'escalated'

    return (
      <TouchableOpacity
        style={[styles.card, needsAction && styles.cardUrgent]}
        onPress={() => onOpenIncident(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.code}>{item.incident_code}</Text>
            <Text style={styles.type}>
              {item.emergency_type === 'crime' ? 'Crime' : 'Medical'}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
              <Text style={[styles.statusText, { color }]}>
                {item.status.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.elapsed}>{getElapsed(item.created_at)}</Text>
          </View>
        </View>

        {item.citizen_address ? (
          <Text style={styles.address} numberOfLines={1}>{item.citizen_address}</Text>
        ) : (
          <Text style={styles.noAddress}>No address captured</Text>
        )}

        {needsAction && (
          <View style={styles.actionTag}>
            <Feather name="alert-circle" size={11} color="#fca5a5" style={{ marginRight: 4 }} />
            <Text style={styles.actionTagText}>Needs Assignment</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const avatarLetter = (profile?.full_name ?? 'T').charAt(0).toUpperCase()

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
          <Text style={styles.role}>TEAM LEADER</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Greeting */}
      {profile?.full_name && (
        <Text style={styles.greeting}>Hello, {profile.full_name}</Text>
      )}

      {/* Active Incidents header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Incidents</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{incidents.length}</Text>
          </View>
        )}
      </View>

      {/* List or empty state */}
      {!loading && incidents.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Feather name="check-circle" size={48} color="rgba(16,185,129,0.7)" />
          </View>
          <Text style={styles.emptyText}>No active incidents</Text>
          <Text style={styles.emptySub}>All clear in your area</Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          renderItem={renderIncident}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

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
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.sidebarAvatar} />
                    ) : (
                      <View style={styles.sidebarAvatarPlaceholder}>
                        <Text style={styles.sidebarAvatarLetter}>{avatarLetter}</Text>
                      </View>
                    )}
                    <Text style={styles.sidebarName} numberOfLines={2}>
                      {profile?.full_name ?? 'Team Leader'}
                    </Text>
                    <View style={styles.sidebarRoleBadge}>
                      <Text style={styles.sidebarRoleText}>TEAM LEADER</Text>
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
  role: {
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
  greeting: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
  },
  countText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardUrgent: {
    borderColor: 'rgba(220,38,38,0.5)',
    backgroundColor: 'rgba(220,38,38,0.05)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLeft: {
    gap: 4,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  code: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  type: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  elapsed: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  address: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
  noAddress: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  actionTag: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  actionTagText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
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
