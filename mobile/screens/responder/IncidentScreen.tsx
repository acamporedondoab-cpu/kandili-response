import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase/client'
import type { Incident, IncidentStatus } from '../../types'

interface Props {
  incidentId: string
  userId: string
  onBack: () => void
}

const STATUS_TRANSITIONS: Partial<Record<IncidentStatus, IncidentStatus>> = {
  assigned: 'accepted',
  accepted: 'en_route',
  en_route: 'arrived',
  arrived: 'pending_citizen_confirmation',
}

const ACTION_LABELS: Partial<Record<IncidentStatus, string>> = {
  assigned: 'Accept Assignment',
  accepted: 'En Route',
  en_route: 'Arrived on Scene',
  arrived: 'Submit for Confirmation',
}

const TIMESTAMP_FIELDS: Partial<Record<IncidentStatus, string>> = {
  accepted: 'accepted_at',
  en_route: 'en_route_at',
  arrived: 'arrived_at',
  resolved: 'resolved_at',
}

export default function IncidentScreen({ incidentId, userId, onBack }: Props) {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notesModalVisible, setNotesModalVisible] = useState(false)
  const [noteWhat, setNoteWhat] = useState('')
  const [noteWhen, setNoteWhen] = useState('')
  const [noteWhere, setNoteWhere] = useState('')
  const [noteWho, setNoteWho] = useState('')
  const [noteHow, setNoteHow] = useState('')
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (incident?.status === 'en_route') {
      startLocationBroadcast()
    } else {
      stopLocationBroadcast()
    }
  }, [incident?.status])

  async function startLocationBroadcast() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    stopLocationBroadcast()

    if (__DEV__) {
      // Simulate responder starting 2km away and moving toward citizen each tick
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const START_OFFSET = 0.018 // ~2km in degrees
      const TICKS = 10
      let tick = 0
      locationIntervalRef.current = setInterval(async () => {
        const fraction = tick / TICKS
        const offset = START_OFFSET * (1 - fraction)
        await supabase
          .from('incidents')
          .update({
            responder_lat: loc.coords.latitude + offset,
            responder_lng: loc.coords.longitude + offset,
          })
          .eq('id', incidentId)
        tick = Math.min(tick + 1, TICKS)
      }, 5000)
      return
    }

    locationIntervalRef.current = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      await supabase
        .from('incidents')
        .update({
          responder_lat: loc.coords.latitude,
          responder_lng: loc.coords.longitude,
        })
        .eq('id', incidentId)
    }, 5000)
  }

  function stopLocationBroadcast() {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current)
      locationIntervalRef.current = null
    }
  }

  useEffect(() => {
    fetchIncident()

    const channel = supabase
      .channel(`responder-incident:${incidentId}:${Date.now()}`)
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
      stopLocationBroadcast()
    }
  }, [incidentId])

  async function fetchIncident() {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single()

    if (error) {
      console.error('[IncidentScreen] fetch error:', error.message)
    } else {
      setIncident(data as Incident)
    }
    setLoading(false)
  }

  async function handleStatusUpdate() {
    if (!incident) return
    const nextStatus = STATUS_TRANSITIONS[incident.status]
    if (!nextStatus) return

    if (incident.status === 'arrived') {
      setNoteWhat('')
      setNoteWhen('')
      setNoteWhere('')
      setNoteWho('')
      setNoteHow('')
      setNotesModalVisible(true)
      return
    }

    const confirmMessages: Partial<Record<IncidentStatus, string>> = {
      arrived: 'Confirm you have arrived on scene?',
    }

    const confirmMsg = confirmMessages[incident.status]
    if (confirmMsg) {
      Alert.alert('Confirm', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => doStatusUpdate(nextStatus, {}) },
      ])
    } else {
      doStatusUpdate(nextStatus, {})
    }
  }

  async function doStatusUpdate(nextStatus: IncidentStatus, extra: Record<string, string | null>) {
    setUpdating(true)
    const tsField = TIMESTAMP_FIELDS[nextStatus]
    const updatePayload: Record<string, string | null> = {
      status: nextStatus,
      ...extra,
    }
    if (tsField) {
      updatePayload[tsField] = new Date().toISOString()
    }
    if (nextStatus === 'pending_citizen_confirmation') {
      updatePayload['resolved_by'] = userId
    }

    const { error } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', incidentId)
      .eq('assigned_responder_id', userId)

    if (error) {
      Alert.alert('Update Failed', error.message)
    } else {
      setIncident((prev) => prev ? { ...prev, status: nextStatus, ...extra } : prev)
    }
    setUpdating(false)
  }

  function handleResolveWithNotes() {
    if (!noteWhat.trim() || !noteHow.trim()) {
      Alert.alert('Required Fields', '"What" and "How / Report Summary" are required before submitting.')
      return
    }
    const formatted = [
      `What: ${noteWhat.trim()}`,
      `When: ${noteWhen.trim() || new Date().toLocaleString()}`,
      `Where: ${noteWhere.trim() || (incident?.citizen_address ?? 'See coordinates')}`,
      `Who: ${noteWho.trim() || 'Not specified'}`,
      `How / Report Summary: ${noteHow.trim()}`,
    ].join('\n')
    setNotesModalVisible(false)
    doStatusUpdate('pending_citizen_confirmation', { notes: formatted })
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

  const nextAction = ACTION_LABELS[incident.status]
  const isResolved = incident.status === 'resolved' || incident.status === 'closed'
  const isPendingConfirmation = incident.status === 'pending_citizen_confirmation'

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
        <View style={styles.codeRow}>
          <Text style={styles.code}>{incident.incident_code}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {incident.emergency_type === 'crime' ? '🚔 CRIME' : '🚑 MEDICAL'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>
            {incident.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {incident.citizen_lat && incident.citizen_lng && (
          <View style={styles.locationCard}>
            <Text style={styles.locationLabel}>Citizen Location</Text>
            {incident.citizen_address && (
              <Text style={styles.locationAddress}>{incident.citizen_address}</Text>
            )}
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: incident.citizen_lat,
                longitude: incident.citizen_lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker
                coordinate={{ latitude: incident.citizen_lat, longitude: incident.citizen_lng }}
                pinColor="#DC2626"
              />
            </MapView>
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${incident.citizen_lat},${incident.citizen_lng}&travelmode=driving`
                Linking.openURL(url)
              }}
            >
              <Text style={styles.navigateButtonText}>🧭 Navigate to Incident</Text>
            </TouchableOpacity>
          </View>
        )}

        {incident.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Incident Notes</Text>
            <Text style={styles.notesText}>{incident.notes}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Reported</Text>
          <Text style={styles.metaValue}>
            {new Date(incident.created_at).toLocaleString()}
          </Text>
        </View>

        {incident.accepted_at && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Accepted</Text>
            <Text style={styles.metaValue}>
              {new Date(incident.accepted_at).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {incident.arrived_at && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Arrived</Text>
            <Text style={styles.metaValue}>
              {new Date(incident.arrived_at).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </ScrollView>

      {isResolved ? (
        <View style={styles.footer}>
          <View style={styles.resolvedFooter}>
            <Text style={styles.resolvedText}>✅ Incident Resolved</Text>
          </View>
        </View>
      ) : isPendingConfirmation ? (
        <View style={styles.footer}>
          <View style={styles.pendingConfirmationFooter}>
            <Text style={styles.pendingConfirmationText}>⏳ Awaiting citizen confirmation...</Text>
            <Text style={styles.pendingConfirmationSub}>The citizen must confirm the incident was handled</Text>
          </View>
        </View>
      ) : nextAction ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionButton, updating && styles.actionButtonDisabled]}
            onPress={handleStatusUpdate}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>{nextAction}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Incident report modal before resolve */}
      <Modal visible={notesModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView contentContainerStyle={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Incident Report</Text>
            <Text style={styles.modalSub}>
              Complete this report before resolving. Used as official record by Team Leader.
            </Text>

            <Text style={styles.fieldLabel}>What <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Nature of the emergency..."
              placeholderTextColor="#4b5563"
              value={noteWhat}
              onChangeText={setNoteWhat}
              autoFocus
            />

            <Text style={styles.fieldLabel}>When</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={`e.g. ${new Date().toLocaleTimeString()}`}
              placeholderTextColor="#4b5563"
              value={noteWhen}
              onChangeText={setNoteWhen}
            />

            <Text style={styles.fieldLabel}>Where</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={incident?.citizen_address ?? 'Location details...'}
              placeholderTextColor="#4b5563"
              value={noteWhere}
              onChangeText={setNoteWhere}
            />

            <Text style={styles.fieldLabel}>Who</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Persons involved, witnesses..."
              placeholderTextColor="#4b5563"
              value={noteWho}
              onChangeText={setNoteWho}
            />

            <Text style={styles.fieldLabel}>How / Report Summary <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti]}
              placeholder="Actions taken, outcome, evidence collected..."
              placeholderTextColor="#4b5563"
              value={noteHow}
              onChangeText={setNoteHow}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setNotesModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, updating && styles.actionButtonDisabled]}
                onPress={handleResolveWithNotes}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Submit for Confirmation</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  statusRow: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  statusValue: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  locationCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    overflow: 'hidden',
  },
  locationLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  locationAddress: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 10,
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
  notesCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
  },
  notesLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notesText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
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
  footer: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  actionButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resolvedFooter: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  resolvedText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '700',
  },
  pendingConfirmationFooter: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  pendingConfirmationText: {
    color: '#f59e0b',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  pendingConfirmationSub: {
    color: '#78716c',
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSub: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  required: {
    color: '#DC2626',
  },
  fieldInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  fieldInputMulti: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 2,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
})
