import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { fetchIncidentMedia, type IncidentMedia } from '../lib/media'

interface Props {
  incidentId: string
  refreshKey?: number
}

export default function MediaGallery({ incidentId, refreshKey }: Props) {
  const [media, setMedia] = useState<IncidentMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<IncidentMedia | null>(null)
  const [videoStatus, setVideoStatus] = useState<AVPlaybackStatus | null>(null)
  const videoRef = useRef<Video>(null)

  useEffect(() => {
    setLoading(true)
    fetchIncidentMedia(incidentId).then((items) => {
      setMedia(items)
      setLoading(false)
    })
  }, [incidentId, refreshKey])

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>MEDIA</Text>
        <ActivityIndicator size="small" color="#6b7280" style={{ marginTop: 8 }} />
      </View>
    )
  }

  if (media.length === 0) return null

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.label}>ATTACHED MEDIA ({media.length})</Text>

        <View style={styles.grid}>
          {media.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.thumb}
              onPress={() => setSelected(item)}
              activeOpacity={0.8}
            >
              {item.media_type === 'photo' ? (
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.videoThumb}>
                  <Feather name="video" size={22} color="#3b82f6" />
                  <Text style={styles.videoThumbLabel}>VIDEO</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {media.map((item) =>
          item.description ? (
            <View key={`d-${item.id}`} style={styles.descRow}>
              <Feather
                name={item.media_type === 'photo' ? 'image' : 'video'}
                size={12}
                color="#6b7280"
              />
              <Text style={styles.descText} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          ) : null
        )}
      </View>

      {/* Lightbox */}
      <Modal
        visible={!!selected}
        animationType="fade"
        statusBarTranslucent
        transparent
        onRequestClose={() => { videoRef.current?.pauseAsync(); setSelected(null) }}
      >
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.lightbox}>
          {selected?.media_type === 'photo' ? (
            <>
              <Image
                source={{ uri: selected.media_url }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              {selected?.description ? (
                <View style={styles.lightboxDesc}>
                  <Text style={styles.lightboxDescText}>{selected.description}</Text>
                </View>
              ) : null}
            </>
          ) : selected?.media_type === 'video' ? (
            <>
              <View style={styles.lightboxVideoWrap}>
                <Video
                  ref={videoRef}
                  source={{ uri: selected.media_url }}
                  style={styles.lightboxVideoPlayer}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay
                  onPlaybackStatusUpdate={setVideoStatus}
                />
                {videoStatus && !('isLoaded' in videoStatus && videoStatus.isLoaded) && (
                  <ActivityIndicator
                    size="large"
                    color="#3b82f6"
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </View>
              {selected?.description ? (
                <View style={styles.lightboxDescBelow}>
                  <Text style={styles.lightboxDescText}>{selected.description}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => { videoRef.current?.pauseAsync(); setSelected(null) }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  label: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  videoThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    borderRadius: 8,
  },
  videoThumbLabel: {
    color: '#3b82f6',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  descRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  descText: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  // Lightbox
  lightbox: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  lightboxImage: {
    width: '100%',
    flex: 1,
  },
  lightboxVideoWrap: {
    width: '100%',
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  lightboxVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  lightboxDesc: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 14,
  },
  lightboxDescBelow: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  lightboxDescText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
