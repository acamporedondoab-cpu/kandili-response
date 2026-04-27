import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  StatusBar,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase/client'
import type { Incident, IncidentStatus } from '../../types'
import MediaGallery from '../../components/MediaGallery'
import MediaCaptureModal from '../../components/MediaCaptureModal'
import { uploadIncidentMedia, type MediaItem } from '../../lib/media'

interface Props {
  incidentId: string
  userId: string
  pendingMedia?: MediaItem[]
  onBack: () => void
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: 'Waiting for team leader',
  escalated: 'Escalated — backup team notified',
  acknowledged: 'Team leader acknowledged',
  assigned: 'Responder assigned',
  accepted: 'Responder accepted',
  en_route: 'Responder on the way',
  arrived: 'Responder arrived',
  pending_citizen_confirmation: 'Responder has marked this resolved',
  resolved: 'Incident resolved',
  closed: 'Incident closed',
}

const STATUS_COLORS: Record<IncidentStatus, string> = {
  pending: '#f59e0b',
  escalated: '#ef4444',
  acknowledged: '#3b82f6',
  assigned: '#8b5cf6',
  accepted: '#06b6d4',
  en_route: '#10b981',
  arrived: '#10b981',
  pending_citizen_confirmation: '#f59e0b',
  resolved: '#6b7280',
  closed: '#374151',
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getEta(incident: Incident): string | null {
  if (
    incident.status !== 'en_route' ||
    !incident.responder_lat ||
    !incident.responder_lng ||
    !incident.citizen_lat ||
    !incident.citizen_lng
  )
    return null
  const km = haversineKm(
    incident.responder_lat,
    incident.responder_lng,
    incident.citizen_lat,
    incident.citizen_lng
  )
  const minutes = Math.ceil((km / 40) * 60)
  if (minutes < 1) return 'Less than 1 min away'
  if (minutes === 1) return '~1 min away'
  return `~${minutes} mins away`
}

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

export default function ActiveIncidentScreen({ incidentId, userId, pendingMedia, onBack }: Props) {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [mediaCaptureVisible, setMediaCaptureVisible] = useState(false)
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0)

  // Auto-upload any media captured before the SOS was dispatched
  useEffect(() => {
    if (!pendingMedia || pendingMedia.length === 0) return
    Promise.all(pendingMedia.map((item) => uploadIncidentMedia(incidentId, userId, item)))
      .then((results) => {
        const failed = results.filter((r) => r.error)
        if (failed.length > 0) {
          Alert.alert('Upload Failed', `${failed.length} file(s) failed: ${failed[0].error}`)
        }
        setMediaRefreshKey((k) => k + 1)
      })
      .catch((err) => Alert.alert('Upload Error', String(err)))
  }, [])

  async function handleAddMedia(item: MediaItem) {
    setMediaCaptureVisible(false)
    const result = await uploadIncidentMedia(incidentId, userId, item)
    if (result.error) {
      Alert.alert('Upload Failed', result.error)
    }
    setMediaRefreshKey((k) => k + 1)
  }

  async function handleConfirmResolution(confirmed: boolean) {
    setConfirming(true)
    const { data, error } = await supabase.rpc('fn_citizen_confirm_resolution', {
      p_incident_id: incidentId,
      p_confirmed: confirmed,
    })

    if (error) {
      Alert.alert('Error', 'Could not submit your response. Please try again.')
      setConfirming(false)
      return
    }

    const resultCode = data?.[0]?.result_code ?? null
    if (resultCode === 'confirmed') {
      setIncident((prev) =>
        prev ? { ...prev, status: 'resolved', citizen_confirmed: true, citizen_confirmed_at: new Date().toISOString() } : prev
      )
    } else if (resultCode === 'disputed') {
      Alert.alert(
        'Thank you',
        'We have notified the responder that your emergency is not yet resolved.',
      )
    }
    setConfirming(false)
  }

  useEffect(() => {
    fetchIncident()

    const channel = supabase
      .channel(`incident:${incidentId}:${Date.now()}`)
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

    if (error) {
      console.error('[ActiveIncidentScreen] fetch error:', error.message)
    } else {
      setIncident(data as Incident)
    }
    setLoading(false)
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
  const statusLabel = STATUS_LABELS[incident.status] ?? incident.status
  const eta = getEta(incident)
  const showMap =
    !!incident.citizen_lat &&
    !!incident.citizen_lng &&
    (incident.status === 'en_route' || incident.status === 'arrived')
  const mapRegion = showMap ? getMapRegion(incident) : null

  function renderMapPins() {
    return (
      <>
        <Marker
          coordinate={{ latitude: incident!.citizen_lat!, longitude: incident!.citizen_lng! }}
          pinColor="#DC2626"
          title="Your Location"
        />
        {incident!.responder_lat && incident!.responder_lng && (
          <Marker
            coordinate={{ latitude: incident!.responder_lat, longitude: incident!.responder_lng }}
            pinColor="#3b82f6"
            title="Responder"
          />
        )}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Incident</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Incident Code</Text>
          <Text style={styles.code}>{incident.incident_code}</Text>
        </View>

        <View style={[styles.statusCard, { borderLeftColor: statusColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>{statusLabel}</Text>
            <Text style={styles.statusRaw}>{incident.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {showMap && mapRegion && (
          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>
                {incident.status === 'arrived' ? '📍 Responder Arrived' : '🚔 Responder En Route'}
              </Text>
              {eta && <Text style={styles.etaText}>{eta}</Text>}
            </View>

            {/* Tap to expand */}
            <TouchableOpacity activeOpacity={0.95} onPress={() => setMapExpanded(true)}>
              <MapView
                style={styles.map}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                pointerEvents="none"
              >
                {renderMapPins()}
              </MapView>
              <View style={styles.expandHint}>
                <Text style={styles.expandHintText}>⛶  Tap to expand</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.legendText}>Your location</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.legendText}>Responder (live)</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Emergency Type</Text>
          <Text style={styles.rowValue}>
            {incident.emergency_type === 'crime' ? '🚔 Crime' : '🚑 Medical'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Reported At</Text>
          <Text style={styles.rowValue}>
            {new Date(incident.created_at).toLocaleTimeString()}
          </Text>
        </View>

        {incident.citizen_address && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Location</Text>
            <Text style={styles.rowValue}>{incident.citizen_address}</Text>
          </View>
        )}

        {/* Media gallery */}
        <MediaGallery incidentId={incidentId} refreshKey={mediaRefreshKey} />

        {/* Add media button */}
        <TouchableOpacity
          style={styles.addMediaBtn}
          onPress={() => setMediaCaptureVisible(true)}
          activeOpacity={0.75}
        >
          <Feather name="camera" size={16} color="#9ca3af" />
          <Text style={styles.addMediaBtnText}>Add Photo / Video</Text>
        </TouchableOpacity>

        {incident.status === 'pending_citizen_confirmation' && (
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Was your emergency handled?</Text>
            <Text style={styles.confirmationSub}>
              The responder has submitted their report. Please confirm if your emergency was truly resolved.
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmNo, confirming && styles.confirmDisabled]}
                onPress={() => handleConfirmResolution(false)}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>No, not yet</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmYes, confirming && styles.confirmDisabled]}
                onPress={() => handleConfirmResolution(true)}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Yes, resolved</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(incident.status === 'resolved' || incident.status === 'closed') && (
          <View style={styles.resolvedBanner}>
            <Text style={styles.resolvedText}>
              {incident.status === 'closed' ? '✅ Incident Closed' : '✅ Incident Resolved'}
            </Text>
            <Text style={styles.resolvedSub}>Help has arrived. Stay safe.</Text>
          </View>
        )}

        <Text style={styles.realtimeNote}>Updates in real-time</Text>
      </ScrollView>

      {/* Media capture modal */}
      <MediaCaptureModal
        visible={mediaCaptureVisible}
        onConfirm={handleAddMedia}
        onCancel={() => setMediaCaptureVisible(false)}
      />

      {/* Fullscreen map modal */}
      {showMap && mapRegion && (
        <Modal visible={mapExpanded} animationType="fade" statusBarTranslucent>
          <StatusBar backgroundColor="#000" barStyle="light-content" />
          <View style={styles.fullscreenContainer}>
            <MapView
              style={styles.fullscreenMap}
              region={mapRegion}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
            >
              {renderMapPins()}
            </MapView>

            {/* ETA overlay */}
            {eta && (
              <View style={styles.fullscreenEta}>
                <Text style={styles.fullscreenEtaText}>{eta}</Text>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setMapExpanded(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Legend overlay */}
            <View style={styles.fullscreenLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.fullscreenLegendText}>Your location</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.fullscreenLegendText}>Responder (live)</Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  backLink: { color: '#DC2626', fontSize: 15, fontWeight: '600', width: 60 },
  content: { padding: 20, gap: 16 },
  codeCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  codeLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  code: { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: 2 },
  statusCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    gap: 12,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statusRaw: { color: '#6b7280', fontSize: 12, marginTop: 2, letterSpacing: 1 },
  mapCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  etaText: { color: '#10b981', fontSize: 14, fontWeight: '700' },
  map: { width: '100%', height: 200 },
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
  legend: { flexDirection: 'row', gap: 20, padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#9ca3af', fontSize: 12 },
  row: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: { color: '#6b7280', fontSize: 14 },
  rowValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  confirmationCard: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  confirmationTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmationSub: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmNo: {
    backgroundColor: '#374151',
  },
  confirmYes: {
    backgroundColor: '#16a34a',
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  resolvedBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resolvedText: { color: '#34d399', fontSize: 16, fontWeight: '700' },
  resolvedSub: { color: '#6ee7b7', fontSize: 13, marginTop: 4 },
  realtimeNote: { color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 8 },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  addMediaBtnText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: { color: '#9ca3af', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  // Fullscreen modal
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },
  fullscreenMap: { flex: 1 },
  fullscreenEta: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: '#10b981',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fullscreenEtaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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
})
