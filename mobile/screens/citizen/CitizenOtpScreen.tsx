import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import auth from '@react-native-firebase/auth'
import { supabase } from '../../lib/supabase/client'
import * as SecureStore from 'expo-secure-store'

interface Props {
  phone: string
  verificationId: string
  registrationData?: { fullName: string; email: string }
  onBack: () => void
  onAuthenticated: () => void
}

const RESEND_COOLDOWN = 30

export default function CitizenOtpScreen({
  phone,
  verificationId,
  registrationData,
  onBack,
  onAuthenticated,
}: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN)
  const inputRefs = useRef<(TextInput | null)[]>(Array(6).fill(null))
  const hasAutoSubmitted = useRef(false)

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 200)
  }, [])

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    const code = newDigits.join('')
    if (code.length === 6 && newDigits.every((d) => d !== '') && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true
      verifyCode(code)
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits]
      newDigits[index - 1] = ''
      setDigits(newDigits)
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function verifyCode(code: string) {
    setLoading(true)
    try {
      const credential = auth.PhoneAuthProvider.credential(verificationId, code)
      const result = await auth().signInWithCredential(credential)
      const firebaseUid = result.user.uid

      const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/citizen-auth`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-citizen-auth-secret': process.env.EXPO_PUBLIC_CITIZEN_AUTH_SECRET!,
        },
        body: JSON.stringify({
          phone,
          firebase_uid: firebaseUid,
          full_name: registrationData?.fullName,
          email: registrationData?.email,
        }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `Server error ${res.status}`)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      })
      if (signInError) throw signInError

      await SecureStore.setItemAsync('citizen_phone_digits', phone.replace('+63', ''))
      onAuthenticated()
    } catch (e: any) {
      hasAutoSubmitted.current = false
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
      Alert.alert('Verification Failed', e?.message ?? 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const maskedPhone = phone.replace('+63', '+63 ').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.inner}>

          {/* Back */}
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🔐</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.heading}>Verify Your Number</Text>
          <Text style={styles.subheading}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
          </Text>

          {/* 6 digit boxes */}
          <View style={styles.digitRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref }}
                style={[styles.digitBox, digit ? styles.digitBoxFilled : null]}
                value={digit}
                onChangeText={(v) => handleDigitChange(i, v)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
                caretHidden
                textAlign="center"
              />
            ))}
          </View>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#DC2626" size="small" />
              <Text style={styles.loadingText}>Verifying...</Text>
            </View>
          )}

          {/* Resend */}
          <View style={styles.resendRow}>
            {resendCountdown > 0 ? (
              <Text style={styles.resendCooldown}>
                Resend code in{' '}
                <Text style={styles.resendTimer}>{resendCountdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
                <Text style={styles.resendLink}>Resend Code</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.hint}>Enter the code to verify your identity</Text>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060d1b',
  },

  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingBottom: 40,
  },

  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },

  iconWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(220,38,38,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 32,
  },

  heading: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  subheading: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  phoneHighlight: {
    color: '#e2e8f0',
    fontWeight: '700',
  },

  digitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  digitBox: {
    width: 48,
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  digitBoxFilled: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220,38,38,0.08)',
  },

  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },

  resendRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resendCooldown: {
    color: '#374d6a',
    fontSize: 13,
  },
  resendTimer: {
    color: '#4b6a8a',
    fontWeight: '700',
  },
  resendLink: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '700',
  },

  hint: {
    color: '#283a50',
    fontSize: 12,
    textAlign: 'center',
  },
})
