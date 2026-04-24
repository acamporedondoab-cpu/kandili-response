import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha'
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth'
import { firebaseApp, firebaseAuth } from '../../lib/firebase'
import { supabase } from '../../lib/supabase/client'
import { signOut } from '../../lib/auth'

interface Props {
  onVerified: () => void
}

export default function PhoneVerificationScreen({ onVerified }: Props) {
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendOtp() {
    const cleaned = phone.trim()
    if (!cleaned.startsWith('+') || cleaned.length < 10) {
      Alert.alert('Invalid phone number', 'Include your country code, e.g. +639171234567')
      return
    }
    setLoading(true)
    try {
      const provider = new PhoneAuthProvider(firebaseAuth)
      const id = await provider.verifyPhoneNumber(cleaned, recaptchaRef.current!)
      setVerificationId(id)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmOtp() {
    if (!verificationId || otp.trim().length !== 6) return
    setLoading(true)
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp.trim())
      await signInWithCredential(firebaseAuth, credential)

      // OTP confirmed — mark as verified in our backend via Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No active session. Please sign in again.')

      const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-phone`
      const httpRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ phone_number: phone.trim() }),
      })
      const resBody = await httpRes.json()
      if (!httpRes.ok) throw new Error(resBody?.error ?? `Error ${httpRes.status}`)

      onVerified()
    } catch (e: any) {
      Alert.alert('Verification Failed', e?.message ?? 'Please check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseApp.options}
        attemptInvisibleVerification
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Text style={styles.title}>Verify Your Phone</Text>
        <Text style={styles.subtitle}>
          {verificationId
            ? 'Enter the 6-digit code sent to your phone.'
            : 'A one-time SMS code will be sent to verify your number before you can use the SOS feature.'}
        </Text>

        {!verificationId ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="+63 917 123 4567"
              placeholderTextColor="#4b5563"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={sendOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor="#4b5563"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, (loading || otp.trim().length !== 6) && styles.buttonDisabled]}
              onPress={confirmOtp}
              disabled={loading || otp.trim().length !== 6}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeLink}
              onPress={() => { setVerificationId(null); setOtp('') }}
            >
              <Text style={styles.changeLinkText}>← Change phone number</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.signOutLink} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  otpInput: {
    fontSize: 30,
    letterSpacing: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  changeLink: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  changeLinkText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signOutLink: {
    alignItems: 'center',
    marginTop: 40,
  },
  signOutText: {
    color: '#4b5563',
    fontSize: 13,
  },
})
