import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signIn } from '../../lib/auth'

import InputField from '../../../components/InputField'
import PrimaryButton from '../../../components/PrimaryButton'

const logo = require('../../assets/logo.png')

interface Props {
  onLoginSuccess: () => void
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const canLogin = email.trim().length > 0 && password.trim().length > 0

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password.')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      onLoginSuccess()
    } catch (err: any) {
      Alert.alert('Login Failed', err.message ?? 'Invalid credentials.')
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

          {/* Brand block */}
          <View style={styles.brandBlock}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandName}>Kandili Dispatch</Text>
            <Text style={styles.brandSub}>Emergency Response Platform</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <InputField
              label="EMAIL"
              placeholder="Enter your email"
              keyboardType="email-address"
              icon="✉️"
              value={email}
              onChangeText={setEmail}
            />

            <InputField
              label="PASSWORD"
              placeholder="Enter your password"
              icon="🔑"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={(!canLogin || loading) ? styles.btnDisabled : undefined}>
            {loading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <PrimaryButton title="Sign In" onPress={handleLogin} />
            )}
          </View>

          <Text style={styles.helperText}>
            Access is restricted to authorized personnel only.
          </Text>

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

  brandBlock: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  logo: {
    width: 160,
    height: 160,
    resizeMode: 'contain',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 6,
  },
  brandSub: {
    color: '#4b6a8a',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
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
})
