import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase/client'
import { signOut } from '../../lib/auth'
import type { Incident, IncidentStatus } from '../../types'

interface Props {
  userId: string
  orgId: string
  fullName: string | null
  onOpenIncident: (incidentId: string) => void
  onGoToHistory: () => void
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

export default function TLDashboardScreen({ userId, orgId, fullName, onOpenIncident, onGoToHistory }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIncidents()

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
        () => {
          fetchIncidents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
              {item.emergency_type === 'crime' ? '🚔 Crime' : '🚑 Medical'}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
              <Text style={[styles.statusText, { color }]}>
                {item.status.replace('_', ' ').toUpperCase()}
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
            <Text style={styles.actionTagText}>⚡ Needs Assignment</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Guardian Dispatch</Text>
          <Text style={styles.role}>TEAM LEADER</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={onGoToHistory}>
            <Text style={styles.historyLink}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.logout}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {fullName && (
        <Text style={styles.greeting}>Hello, {fullName.split(' ')[0]}</Text>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Incidents</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : (
          <Text style={styles.count}>{incidents.length}</Text>
        )}
      </View>

      {!loading && incidents.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✅</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  appName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  role: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  logout: {
    color: '#6b7280',
    fontSize: 14,
  },
  historyLink: {
    color: '#6b7280',
    fontSize: 14,
  },
  greeting: {
    color: '#9ca3af',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  count: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardUrgent: {
    borderColor: '#DC2626',
    backgroundColor: '#1a1212',
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  type: {
    color: '#9ca3af',
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
    color: '#4b5563',
    fontSize: 12,
  },
  address: {
    color: '#6b7280',
    fontSize: 13,
  },
  noAddress: {
    color: '#374151',
    fontSize: 13,
    fontStyle: 'italic',
  },
  actionTag: {
    marginTop: 10,
    backgroundColor: '#450a0a',
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    color: '#6b7280',
    fontSize: 14,
  },
})
