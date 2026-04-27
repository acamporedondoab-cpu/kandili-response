import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Feather, FontAwesome5 } from '@expo/vector-icons'
import type { EmergencyType } from '../types'

const { width } = Dimensions.get('window')
const TILE = (width - 80) / 2

interface Props {
  visible: boolean
  onSelect: (type: EmergencyType) => void
  onCancel: () => void
}

type Option = {
  type: EmergencyType
  label: string
  icon: React.ReactNode
  selectedIcon: React.ReactNode
}

export default function EmergencyTypeModal({ visible, onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<EmergencyType | null>(null)

  const options: Option[] = [
    {
      type: 'crime',
      label: 'POLICE',
      icon: <Feather name="shield" size={40} color="rgba(255,255,255,0.7)" />,
      selectedIcon: <Feather name="shield" size={40} color="#DC2626" />,
    },
    {
      type: 'medical',
      label: 'MEDICAL',
      icon: <FontAwesome5 name="ambulance" size={36} color="rgba(255,255,255,0.7)" />,
      selectedIcon: <FontAwesome5 name="ambulance" size={36} color="#DC2626" />,
    },
  ]

  function handleSend() {
    if (!selected) return
    setSelected(null)
    onSelect(selected)
  }

  function handleCancel() {
    setSelected(null)
    onCancel()
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>SELECT EMERGENCY TYPE</Text>
          <Text style={styles.subtitle}>Choose the nature of your emergency</Text>

          {/* Option tiles */}
          <View style={styles.tilesRow}>
            {options.map((opt) => {
              const isSelected = selected === opt.type
              return (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.tile, isSelected && styles.tileSelected]}
                  onPress={() => setSelected(opt.type)}
                  activeOpacity={0.85}
                >
                  {/* Hex border accent top */}
                  <View style={[styles.tileAccent, isSelected && styles.tileAccentSelected]} />

                  <View style={styles.tileInner}>
                    {isSelected ? opt.selectedIcon : opt.icon}
                    <Text style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                      {opt.label}
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.selectedDot} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelRow} onPress={handleCancel}>
            <View style={styles.cancelCircle}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </View>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>

          {/* Send Alert */}
          <TouchableOpacity
            style={[styles.sendButton, !selected && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Feather name="send" size={16} color={selected ? '#fff' : 'rgba(255,255,255,0.3)'} style={{ marginRight: 10 }} />
            <Text style={[styles.sendText, !selected && styles.sendTextDisabled]}>
              SEND ALERT
            </Text>
          </TouchableOpacity>

          {/* Dispatch label */}
          <Text style={styles.dispatchLabel}>
            DISPATCHES TO:{' '}
            <Text style={styles.dispatchValue}>CURRENT LOCATION</Text>
          </Text>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,7,18,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    width: '100%',
    backgroundColor: '#0A0F1E',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.12)',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 28,
    letterSpacing: 0.3,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  tile: {
    width: TILE,
    height: TILE * 1.05,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  tileSelected: {
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderColor: '#DC2626',
  },
  tileAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,229,255,0.2)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tileAccentSelected: {
    backgroundColor: '#DC2626',
  },
  tileInner: {
    alignItems: 'center',
    gap: 14,
  },
  tileLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  tileLabelSelected: {
    color: '#FFFFFF',
  },
  selectedDot: {
    position: 'absolute',
    bottom: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  cancelRow: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  cancelCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  sendButton: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 50,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  sendTextDisabled: {
    color: 'rgba(255,255,255,0.25)',
  },
  dispatchLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  dispatchValue: {
    color: 'rgba(0,229,255,0.6)',
    fontWeight: '700',
  },
})
