import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import { supabase } from '../../lib/supabase/client'
import type { Incident, Profile } from '../../types'
import MediaGallery from '../../components/MediaGallery'

function getMapRegion(incident: Incident) {
  const cLat = incident.citizen_lat!
  const cLng = incident.citizen_lng!

  if (incident.responder_lat && incident.responder_lng) {
    const rLat = incident.responder_lat
    const rLng = incident.responder_lng
    const minLat = Math.min(cLat, rLat)
    const maxLat = Math.max(cLat, rLat)
    const minLng = Math.min(cLng, rLng)
    const maxLng = Math.max(cLng, rLng)
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.01),
      longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.01),
    }
  }

  return { latitude: cLat, longitude: cLng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
}

interface Props {
  incidentId: string
  tlUserId: string
  orgId: string
  onBack: () => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  escalated: '#ef4444',
  acknowledged: '#3b82f6',
  assigned: '#8b5cf6',
  accepted: '#06b6d4',
  en_route: '#10b981',
  arrived: '#10b981',
  resolved: '#6b7280',
  closed: '#374151',
}

export default function TLIncidentDetailScreen({ incidentId, tlUserId, orgId, onBack }: Props) {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [responders, setResponders] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [mapExpanded, setMapExpanded] = useState(false)

  useEffect(() => {
    fetchIncident()
    fetchResponders()

    const channel = supabase
      .channel(`tl-incident:${incidentId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incidents',
          filter: `id=eq.${incidentId}`,
        },
        (payload) => {
          setIncident((prev) => ({ ...prev, ...payload.new } as Incident))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [incidentId])

  async function fetchIncident() {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single()

    if (!error) setIncident(data as Incident)
    setLoading(false)
  }

  async function fetchResponders() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, organization_id, is_on_duty, is_suspended, fcm_token, abuse_strike_count, created_at, updated_at')
      .eq('organization_id', orgId)
      .eq('role', 'responder')
      .eq('is_on_duty', true)
      .eq('is_suspended', false)

    setResponders(data ? (data as Profile[]) : [])
  }

  async function handleAssign(responder: Profile) {
    Alert.alert(
      'Assign Responder',
      `Assign ${responder.full_name ?? 'this responder'} to the incident?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setAssigning(responder.id)
            const { error } = await supabase
              .from('incidents')
              .update({
                assigned_responder_id: responder.id,
                assigned_tl_id: tlUserId,
                status: 'assigned',
                responder_assigned_at: new Date().toISOString(),
              })
              .eq('id', incidentId)

            if (error) {
              Alert.alert('Assignment Failed', error.message)
            } else {
              setIncident((prev) =>
                prev
                  ? {
                      ...prev,
                      assigned_responder_id: responder.id,
                      assigned_tl_id: tlUserId,
                      status: 'assigned',
                    }
                  : prev
              )
            }
            setAssigning(null)
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" />
      </SafeAreaView>
    )
  }

  if (!incident) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Incident not found</Text>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const statusColor = STATUS_COLORS[incident.status] ?? '#6b7280'
  const canAssign = ['pending', 'escalated', 'acknowledged'].includes(incident.status)
  const isResolved = incident.status === 'resolved' || incident.status === 'closed'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident Detail</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Incident code + type */}
        <View style={styles.codeRow}>
          <Text style={styles.code}>{incident.incident_code}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {incident.emergency_type === 'crime' ? '🚔 CRIME' : '🚑 MEDICAL'}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={[styles.statusCard, { borderLeftColor: statusColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusValue, { color: statusColor }]}>
            {incident.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Location */}
        {incident.citizen_lat && incident.citizen_lng && (
          <View style={[styles.infoCard, { overflow: 'hidden' }]}>
            <Text style={styles.infoLabel}>
              Incident Location{incident.responder_lat ? '  •  🔵 Responder Live' : ''}
            </Text>
            {incident.citizen_address && (
              <Text style={[styles.infoValue, { marginBottom: 10 }]}>{incident.citizen_address}</Text>
            )}

            {/* Tap to expand */}
            <TouchableOpacity activeOpacity={0.95} onPress={() => setMapExpanded(true)}>
              <MapView
                style={styles.map}
                region={getMapRegion(incident)}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                pointerEvents="none"
              >
                <Marker
                  coordinate={{ latitude: incident.citizen_lat, longitude: incident.citizen_lng }}
                  pinColor="#DC2626"
                  title="Incident Location"
                />
                {incident.responder_lat && incident.responder_lng && (
                  <Marker
                    coordinate={{ latitude: incident.responder_lat, longitude: incident.responder_lng }}
                    pinColor="#3b82f6"
                    title="Responder"
                  />
                )}
              </MapView>
              <View style={styles.expandHint}>
                <Text style={styles.expandHintText}>⛶  Tap to expand</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.responderLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.legendText}>Incident</Text>
              </View>
              {incident.responder_lat && incident.responder_lng && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.legendText}>Responder (live)</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${incident.citizen_lat},${incident.citizen_lng}&travelmode=driving`
                Linking.openURL(url)
              }}
            >
              <Text style={styles.navigateButtonText}>🧭 Open in Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Time */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Reported</Text>
          <Text style={styles.metaValue}>
            {new Date(incident.created_at).toLocaleString()}
          </Text>
        </View>

        {/* Current responder */}
        {incident.assigned_responder_id && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Assigned Responder</Text>
            <Text style={styles.infoValue}>{incident.assigned_responder_id}</Text>
          </View>
        )}

        {/* Responder notes */}
        {incident.notes && (
          <View style={[styles.infoCard, { borderLeftWidth: 3, borderLeftColor: '#3b82f6' }]}>
            <Text style={styles.infoLabel}>Responder Notes</Text>
            <Text style={styles.infoValue}>{incident.notes}</Text>
          </View>
        )}

        <MediaGallery incidentId={incidentId} />

        {/* Resolved banner */}
        {isResolved && (
          <View style={styles.resolvedBanner}>
            <Text style={styles.resolvedText}>✅ Incident {incident.status === 'closed' ? 'Closed' : 'Resolved'}</Text>
          </View>
        )}

        {/* Assign section */}
        {canAssign && (
          <View style={styles.assignSection}>
            <Text style={styles.assignTitle}>
              {responders.length > 0
                ? `Assign Responder (${responders.length} on duty)`
                : 'No On-Duty Responders'}
            </Text>

            {responders.length === 0 && (
              <Text style={styles.noResponders}>
                All responders are off duty. Ask someone to go on duty first.
              </Text>
            )}

            {responders.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.responderRow,
                  assigning === r.id && styles.responderRowDisabled,
                ]}
                onPress={() => handleAssign(r)}
                disabled={assigning !== null}
              >
                <View>
                  <Text style={styles.responderName}>{r.full_name ?? 'Unnamed Responder'}</Text>
                  <Text style={styles.responderSub}>On Duty</Text>
                </View>
                {assigning === r.id ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text style={styles.assignBtn}>Assign →</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Already assigned and active */}
        {!canAssign && !isResolved && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Dispatch Status</Text>
            <Text style={styles.infoValue}>Responder is handling this incident</Text>
          </View>
        )}
      </ScrollView>

      {/* Fullscreen map modal */}
      {incident.citizen_lat && incident.citizen_lng && (
        <Modal visible={mapExpanded} animationType="fade" statusBarTranslucent>
          <StatusBar backgroundColor="#000" barStyle="light-content" />
          <View style={styles.fullscreenContainer}>
            <MapView
              style={styles.fullscreenMap}
              region={getMapRegion(incident)}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker
                coordinate={{ latitude: incident.citizen_lat, longitude: incident.citizen_lng }}
                pinColor="#DC2626"
                title="Incident Location"
              />
              {incident.responder_lat && incident.responder_lng && (
                <Marker
                  coordinate={{ latitude: incident.responder_lat, longitude: incident.responder_lng }}
                  pinColor="#3b82f6"
                  title="Responder"
                />
              )}
            </MapView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setMapExpanded(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.fullscreenLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.fullscreenLegendText}>Incident</Text>
              </View>
              {incident.responder_lat && incident.responder_lng && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.fullscreenLegendText}>Responder (live)</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
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
  content: {
    padding: 20,
    gap: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  code: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  typeBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  infoLabel: {
    color: '#6b7280',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  map: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
  },
  navigateButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  expandHint: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  expandHintText: { color: '#fff', fontSize: 11 },
  responderLegend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 4,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },
  fullscreenMap: { flex: 1 },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  fullscreenLegend: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fullscreenLegendText: { color: '#fff', fontSize: 13 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLabel: {
    color: '#4b5563',
    fontSize: 13,
  },
  metaValue: {
    color: '#6b7280',
    fontSize: 13,
  },
  resolvedBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resolvedText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '700',
  },
  assignSection: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  assignTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  noResponders: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  responderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  responderRowDisabled: {
    opacity: 0.5,
  },
  responderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  responderSub: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
  },
  assignBtn: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
})
