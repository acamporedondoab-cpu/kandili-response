import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import type { MediaItem } from '../lib/media'

interface Props {
  visible: boolean
  onConfirm: (item: MediaItem) => void
  onCancel: () => void
}

type CaptureState = 'choose' | 'review'

export default function MediaCaptureModal({ visible, onConfirm, onCancel }: Props) {
  const [stage, setStage] = useState<CaptureState>('choose')
  const [captured, setCaptured] = useState<{ uri: string; type: 'photo' | 'video' } | null>(null)
  const [description, setDescription] = useState('')
  const [launching, setLaunching] = useState(false)

  function reset() {
    setStage('choose')
    setCaptured(null)
    setDescription('')
    setLaunching(false)
  }

  async function handleCapture(type: 'photo' | 'video') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings.')
      return
    }

    setLaunching(true)
    try {
      const result = type === 'photo'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            videoMaxDuration: 20,
          })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        if (type === 'video' && asset.duration != null && asset.duration < 7000) {
          Alert.alert('Video Too Short', 'Video must be at least 7 seconds long. Please try again.')
          return
        }
        setCaptured({ uri: asset.uri, type })
        setStage('review')
      }
    } catch {
      Alert.alert('Error', 'Failed to capture media. Please try again.')
    } finally {
      setLaunching(false)
    }
  }

  function handleConfirm() {
    if (!captured) return
    onConfirm({ uri: captured.uri, type: captured.type, description })
    reset()
  }

  function handleCancel() {
    reset()
    onCancel()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {stage === 'choose' ? 'Add Media' : 'Review & Attach'}
            </Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {stage === 'choose' ? (
            /* ── Choose capture type ── */
            <View style={styles.chooseRow}>
              <TouchableOpacity
                style={[styles.captureBtn, launching && styles.captureBtnDisabled]}
                onPress={() => handleCapture('photo')}
                disabled={launching}
                activeOpacity={0.75}
              >
                {launching ? (
                  <ActivityIndicator color="#DC2626" size="large" />
                ) : (
                  <Feather name="camera" size={32} color="#DC2626" />
                )}
                <Text style={styles.captureBtnLabel}>Take Photo</Text>
              </TouchableOpacity>

              <View style={styles.captureDivider} />

              <TouchableOpacity
                style={[styles.captureBtn, launching && styles.captureBtnDisabled]}
                onPress={() => handleCapture('video')}
                disabled={launching}
                activeOpacity={0.75}
              >
                {launching ? (
                  <ActivityIndicator color="#3b82f6" size="large" />
                ) : (
                  <Feather name="video" size={32} color="#3b82f6" />
                )}
                <Text style={[styles.captureBtnLabel, { color: '#3b82f6' }]}>
                  Record Video
                </Text>
                <Text style={styles.videoLimit}>7 – 20 seconds</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Review captured media ── */
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.reviewScroll}>
              {/* Preview */}
              {captured?.type === 'photo' ? (
                <Image
                  source={{ uri: captured.uri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.videoPreview}>
                  <Feather name="video" size={40} color="#3b82f6" />
                  <Text style={styles.videoPreviewLabel}>Video recorded (7 – 20s)</Text>
                </View>
              )}

              <TouchableOpacity style={styles.retakeRow} onPress={() => setStage('choose')}>
                <Feather name="refresh-cw" size={13} color="#6b7280" />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>

              {/* Description */}
              <Text style={styles.descLabel}>Description</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Brief description of what this shows..."
                placeholderTextColor="#4b5563"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Text style={styles.confirmBtnText}>Attach</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  // Choose stage
  chooseRow: {
    flexDirection: 'row',
    paddingVertical: 32,
  },
  captureBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  captureBtnDisabled: {
    opacity: 0.4,
  },
  captureBtnLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  videoLimit: {
    color: '#6b7280',
    fontSize: 11,
  },
  captureDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  // Review stage
  reviewScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
  },
  videoPreview: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  videoPreviewLabel: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  retakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  retakeText: {
    color: '#6b7280',
    fontSize: 13,
  },
  descLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  descInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
})
