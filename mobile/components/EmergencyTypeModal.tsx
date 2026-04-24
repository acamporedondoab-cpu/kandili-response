import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { EmergencyType } from '../types'

interface Props {
  visible: boolean
  onSelect: (type: EmergencyType) => void
  onCancel: () => void
}

export default function EmergencyTypeModal({ visible, onSelect, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Emergency Type</Text>
          <Text style={styles.subtitle}>What kind of emergency?</Text>

          <TouchableOpacity style={[styles.option, styles.crime]} onPress={() => onSelect('crime')}>
            <Text style={styles.optionIcon}>🚔</Text>
            <Text style={styles.optionText}>Crime</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.option, styles.medical]} onPress={() => onSelect('medical')}>
            <Text style={styles.optionIcon}>🚑</Text>
            <Text style={styles.optionText}>Medical</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  crime: {
    backgroundColor: '#1e3a5f',
  },
  medical: {
    backgroundColor: '#1a3a2a',
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  optionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cancel: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#6b7280',
    fontSize: 15,
  },
})
