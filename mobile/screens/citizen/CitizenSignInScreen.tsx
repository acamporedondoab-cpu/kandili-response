import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import auth from '@react-native-firebase/auth'
import * as SecureStore from 'expo-secure-store'

import LogoHeader from '../../../components/LogoHeader'
import InputField from '../../../components/InputField'
import PrimaryButton from '../../../components/PrimaryButton'
import TrustCard from '../../../components/TrustCard'

interface Props {
  onContinue: (phone: string, verificationId: string) => void
  onRegister: () => void
  onStaffLogin: () => void
}

export default function CitizenSignInScreen({ onContinue, onRegister, onStaffLogin }: Props) {
  const [phoneDigits, setPhoneDigits] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    SecureStore.getItemAsync('citizen_phone_digits').then((saved) => {
      if (saved) setPhoneDigits(saved)
    })
  }, [])

  const fullPhone = '+63' + phoneDigits.replace(/\D/g, '')
  const canContinue = phoneDigits.replace(/\D/g, '').length >= 9

  async function handleSendCode() {
    if (fullPhone.length < 12) {
      Alert.alert('Invalid phone number', 'Please enter a valid Philippine mobile number.')
      return
    }
    setLoading(true)
    try {
      const confirmation = await auth().signInWithPhoneNumber(fullPhone)
      onContinue(fullPhone, confirmation.verificationId)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send verification code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          <LogoHeader />

          <View style={styles.waveBadge}>
            <View style={styles.waveCircle}>
              <Text style={styles.waveIcon}>👋</Text>
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>Welcome Back</Text>
            <Text style={styles.subtitleText}>Sign in with your phone number</Text>
          </View>

          <View style={styles.form}>
            <InputField
              label="PHONE NUMBER"
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              icon="📞"
              prefix="+63"
              value={phoneDigits}
              onChangeText={(t: string) => setPhoneDigits(t.replace(/\D/g, ''))}
            />
          </View>

          <View style={(!canContinue || loading) ? styles.btnDisabled : undefined}>
            {loading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <PrimaryButton title="Send Code" onPress={handleSendCode} />
            )}
          </View>

          <Text style={styles.helperText}>
            We'll send a verification code to confirm your phone number.
          </Text>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity onPress={onRegister} activeOpacity={0.7} style={styles.registerRow}>
            <Text style={styles.registerText}>
              New here?{' '}
              <Text style={styles.registerLink}>Create Account</Text>
            </Text>
          </TouchableOpacity>

          <TrustCard />

          <TouchableOpacity onPress={onStaffLogin} activeOpacity={0.7} style={styles.staffLink}>
            <Text style={styles.staffLinkText}>For responders & team leaders →</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060d1b',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },

  waveBadge: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  waveCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(59,130,246,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveIcon: {
    fontSize: 28,
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitleText: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '400',
  },

  form: {
    gap: 16,
    marginBottom: 4,
  },

  btnDisabled: {
    opacity: 0.4,
  },
  loadingBtn: {
    marginTop: 24,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  helperText: {
    marginTop: 12,
    color: '#4b6a8a',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  dividerText: {
    color: '#374d6a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },

  registerRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  registerText: {
    color: '#6b7280',
    fontSize: 14,
  },
  registerLink: {
    color: '#3b82f6',
    fontWeight: '700',
  },

  staffLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  staffLinkText: {
    color: '#283a50',
    fontSize: 12,
    fontWeight: '500',
  },
})
