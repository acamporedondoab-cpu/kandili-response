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
import type { Incident } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function ResponderHistoryScreen({ userId, onBack }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('assigned_responder_id', userId)
      .in('status', ['resolved', 'closed'])
      .order('created_at', { ascending: false })

    setIncidents(data ? (data as Incident[]) : [])
    setLoading(false)
  }

  function renderItem({ item }: { item: Incident }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.code}>{item.incident_code}</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {item.emergency_type === 'crime' ? '🚔 Crime' : '🚑 Medical'}
          </Text>
        </View>

        {item.citizen_address && (
          <Text style={styles.address} numberOfLines={1}>{item.citizen_address}</Text>
        )}

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Arrived</Text>
          <Text style={styles.metaValue}>{formatTime(item.arrived_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Resolved</Text>
          <Text style={styles.metaValue}>{formatTime(item.resolved_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Duration (assigned → resolved)</Text>
          <Text style={styles.metaValue}>{getDuration(item.responder_assigned_at, item.resolved_at)}</Text>
        </View>

        {item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Your Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {item.citizen_confirmed ? (
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedBadgeText}>✓ Confirmed by citizen</Text>
          </View>
        ) : (
          <View style={styles.unconfirmedBadge}>
            <Text style={styles.unconfirmedBadgeText}>⚠ Not confirmed by citizen</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident History</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#DC2626" />
      ) : incidents.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No resolved incidents</Text>
          <Text style={styles.emptySub}>Incidents you resolve will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  backLink: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
    width: 60,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  code: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  date: {
    color: '#6b7280',
    fontSize: 13,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  typeBadgeText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  address: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {
    color: '#4b5563',
    fontSize: 13,
  },
  metaValue: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  notesBox: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  notesLabel: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  notesText: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  confirmedBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#064e3b',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirmedBadgeText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
  unconfirmedBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1c1917',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#44403c',
  },
  unconfirmedBadgeText: {
    color: '#78716c',
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
    textAlign: 'center',
  },
})
