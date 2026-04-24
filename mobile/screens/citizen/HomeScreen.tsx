import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { signOut } from '../../lib/auth'
import type { EmergencyType, Incident } from '../../types'
import EmergencyTypeModal from '../../components/EmergencyTypeModal'
import { supabase } from '../../lib/supabase/client'

interface Props {
  userId: string
  onSosDispatched: (incidentId: string) => void
  onGoToActiveIncident: (incidentId: string) => void
  onGoToHistory: () => void
}

export default function HomeScreen({ userId, onSosDispatched, onGoToActiveIncident, onGoToHistory }: Props) {
  const [modalVisible, setModalVisible] = useState(false)
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null)
  const progress = useRef(new Animated.Value(0)).current
  const holdAnimation = useRef<Animated.CompositeAnimation | null>(null)

  // Check for existing active incident on mount
  useEffect(() => {
    checkActiveIncident()
  }, [])

  async function checkActiveIncident() {
    const openStatuses = ['pending', 'escalated', 'acknowledged', 'assigned', 'accepted', 'en_route', 'arrived', 'pending_citizen_confirmation']
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

  function handlePressIn() {
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
      }
    })
  }

  function handlePressOut() {
    holdAnimation.current?.stop()
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }

  function handleTypeSelected(type: EmergencyType) {
    setModalVisible(false)
    onSosDispatched(type as any)
  }

  const buttonScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  })

  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.4, 1],
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Guardian Dispatch</Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={onGoToHistory}>
            <Text style={styles.historyLink}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure?', [
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
          }}
        >
          <Text style={styles.logout}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeIncident && (
        <TouchableOpacity
          style={styles.activeIncidentBanner}
          onPress={() => onGoToActiveIncident(activeIncident.id)}
        >
          <Text style={styles.activeIncidentText}>
            Active Incident: {activeIncident.incident_code}
          </Text>
          <Text style={styles.activeIncidentSub}>
            {activeIncident.status.replace('_', ' ').toUpperCase()} — tap to view
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.center}>
        <Text style={styles.instruction}>Hold for 2 seconds to activate SOS</Text>

        <View style={styles.buttonWrapper}>
          <Animated.View style={[styles.ring, { opacity: ringOpacity }]} />
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Pressable
              style={styles.sosButton}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={styles.sosText}>SOS</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Text style={styles.hint}>Release to cancel</Text>
      </View>

      <EmergencyTypeModal
        visible={modalVisible}
        onSelect={handleTypeSelected}
        onCancel={() => {
          setModalVisible(false)
          progress.setValue(0)
        }}
      />
    </SafeAreaView>
  )
}

const SOS_SIZE = 180

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
  activeIncidentBanner: {
    backgroundColor: '#DC2626',
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 14,
  },
  activeIncidentText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  activeIncidentSub: {
    color: '#fca5a5',
    fontSize: 13,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instruction: {
    color: '#9ca3af',
    fontSize: 15,
    marginBottom: 48,
    textAlign: 'center',
  },
  buttonWrapper: {
    width: SOS_SIZE + 60,
    height: SOS_SIZE + 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: SOS_SIZE + 48,
    height: SOS_SIZE + 48,
    borderRadius: (SOS_SIZE + 48) / 2,
    borderWidth: 4,
    borderColor: '#DC2626',
  },
  sosButton: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  sosText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
  },
  hint: {
    color: '#4b5563',
    fontSize: 13,
    marginTop: 36,
  },
})
