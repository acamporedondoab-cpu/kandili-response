import React, { useRef, useState } from 'react'
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
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha'
import { PhoneAuthProvider } from 'firebase/auth'
import { firebaseApp, firebaseAuth } from '../../lib/firebase'

import LogoHeader from '../../../components/LogoHeader'
import AvatarBadge from '../../../components/AvatarBadge'
import InputField from '../../../components/InputField'
import PrimaryButton from '../../../components/PrimaryButton'
import TrustCard from '../../../components/TrustCard'

interface Props {
  onContinue: (
    data: { phone: string; fullName: string; email: string },
    verificationId: string
  ) => void
  onSignIn: () => void
  onStaffLogin: () => void
}

export default function CitizenRegisterScreen({ onContinue, onSignIn, onStaffLogin }: Props) {
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null)
  const [fullName, setFullName] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const fullPhone = '+63' + phoneDigits.replace(/\D/g, '')
  const canContinue = fullName.trim().length > 0 && phoneDigits.replace(/\D/g, '').length >= 9

  async function handleContinue() {
    if (!fullName.trim()) {
      Alert.alert('Full name required', 'Please enter your full name.')
      return
    }
    if (fullPhone.length < 12) {
      Alert.alert('Invalid phone number', 'Please enter a valid Philippine mobile number.')
      return
    }
    setLoading(true)
    try {
      const provider = new PhoneAuthProvider(firebaseAuth)
      const verificationId = await provider.verifyPhoneNumber(fullPhone, recaptchaRef.current!)
      onContinue({ phone: fullPhone, fullName: fullName.trim(), email: email.trim() }, verificationId)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send verification code.')
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* 3. LogoHeader */}
          <LogoHeader />

          {/* 4. AvatarBadge */}
          <AvatarBadge />

          {/* 5. Title section */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>Create Your Account</Text>
            <Text style={styles.subtitleText}>Join WeTrack and get help fast</Text>
          </View>

          {/* 6. Form */}
          <View style={styles.form}>
            <InputField
              label="FULL NAME"
              placeholder="Enter your full name"
              helper="Used to identify you during emergencies."
              icon="👤"
              value={fullName}
              onChangeText={setFullName}
            />

            <InputField
              label="PHONE NUMBER"
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              icon="📞"
              prefix="+63"
              value={phoneDigits}
              onChangeText={(t: string) => setPhoneDigits(t.replace(/\D/g, ''))}
            />

            <InputField
              label="EMAIL (OPTIONAL)"
              placeholder="Enter your email address"
              helper="So we can reach you when needed."
              keyboardType="email-address"
              icon="✉️"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* 7. PrimaryButton */}
          <View style={(!canContinue || loading) ? styles.btnDisabled : undefined}>
            {loading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <PrimaryButton title="Continue" onPress={handleContinue} />
            )}
          </View>

          {/* 8. Helper text */}
          <Text style={styles.helperText}>
            We'll send a verification code to confirm your phone number.
          </Text>

          {/* 9. Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 10. Sign In text */}
          <TouchableOpacity onPress={onSignIn} activeOpacity={0.7} style={styles.signInRow}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          {/* 11. TrustCard */}
          <TrustCard />

          {/* Staff link */}
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

  // 5. Title section
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

  // 6. Form
  form: {
    gap: 16,
    marginBottom: 4,
  },

  // 7. Button states
  btnDisabled: {
    opacity: 0.4,
  },
  loadingBtn: {
    marginTop: 24,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 8. Helper text
  helperText: {
    marginTop: 12,
    color: '#4b6a8a',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  // 9. Divider
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

  // 10. Sign In
  signInRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  signInText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signInLink: {
    color: '#3b82f6',
    fontWeight: '700',
  },

  // Staff link
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
