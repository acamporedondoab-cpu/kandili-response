import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase/client'
import { getCurrentProfile, signOut } from './lib/auth'
import { registerForPushNotifications } from './lib/notifications'
import type { Profile, EmergencyType } from './types'

// Screens
import LoginScreen from './screens/auth/LoginScreen'
import CitizenRegisterScreen from './screens/citizen/CitizenRegisterScreen'
import CitizenOtpScreen from './screens/citizen/CitizenOtpScreen'
import CitizenSignInScreen from './screens/citizen/CitizenSignInScreen'
import HomeScreen from './screens/citizen/HomeScreen'
import CountdownScreen from './screens/citizen/CountdownScreen'
import ActiveIncidentScreen from './screens/citizen/ActiveIncidentScreen'
import CitizenHistoryScreen from './screens/citizen/CitizenHistoryScreen'
import DutyScreen from './screens/responder/DutyScreen'
import IncidentScreen from './screens/responder/IncidentScreen'
import ResponderHistoryScreen from './screens/responder/ResponderHistoryScreen'
import TLDashboardScreen from './screens/tl/TLDashboardScreen'
import TLIncidentDetailScreen from './screens/tl/TLIncidentDetailScreen'
import TLHistoryScreen from './screens/tl/TLHistoryScreen'
import PhoneVerificationScreen from './screens/citizen/PhoneVerificationScreen'

// ─── Citizen Stack ────────────────────────────────────────────────────────────
type CitizenParamList = {
  Home: undefined
  Countdown: { emergencyType: EmergencyType }
  ActiveIncident: { incidentId: string }
  CitizenHistory: undefined
}

const CitizenStack = createNativeStackNavigator<CitizenParamList>()

function CitizenNavigator({ userId }: { userId: string }) {
  return (
    <CitizenStack.Navigator screenOptions={{ headerShown: false }}>
      <CitizenStack.Screen name="Home">
        {(props) => (
          <HomeScreen
            userId={userId}
            onSosDispatched={(type: any) =>
              props.navigation.navigate('Countdown', { emergencyType: type })
            }
            onGoToActiveIncident={(id) =>
              props.navigation.navigate('ActiveIncident', { incidentId: id })
            }
            onGoToHistory={() => props.navigation.navigate('CitizenHistory')}
          />
        )}
      </CitizenStack.Screen>

      <CitizenStack.Screen name="Countdown">
        {(props) => {
          const { emergencyType } = props.route.params
          return (
            <CountdownScreen
              emergencyType={emergencyType}
              onDispatched={(id) => {
                props.navigation.replace('ActiveIncident', { incidentId: id })
              }}
              onCancelled={() => props.navigation.goBack()}
            />
          )
        }}
      </CitizenStack.Screen>

      <CitizenStack.Screen name="ActiveIncident">
        {(props) => (
          <ActiveIncidentScreen
            incidentId={props.route.params.incidentId}
            onBack={() => props.navigation.navigate('Home')}
          />
        )}
      </CitizenStack.Screen>

      <CitizenStack.Screen name="CitizenHistory">
        {(props) => (
          <CitizenHistoryScreen
            userId={userId}
            onBack={() => props.navigation.goBack()}
          />
        )}
      </CitizenStack.Screen>
    </CitizenStack.Navigator>
  )
}

// ─── Responder Stack ──────────────────────────────────────────────────────────
type ResponderParamList = {
  Duty: undefined
  Incident: { incidentId: string }
  ResponderHistory: undefined
}

const ResponderStack = createNativeStackNavigator<ResponderParamList>()

function ResponderNavigator({ userId }: { userId: string }) {
  return (
    <ResponderStack.Navigator screenOptions={{ headerShown: false }}>
      <ResponderStack.Screen name="Duty">
        {(props) => (
          <DutyScreen
            userId={userId}
            onOpenIncident={(id) =>
              props.navigation.navigate('Incident', { incidentId: id })
            }
            onGoToHistory={() => props.navigation.navigate('ResponderHistory')}
          />
        )}
      </ResponderStack.Screen>

      <ResponderStack.Screen name="Incident">
        {(props) => (
          <IncidentScreen
            incidentId={props.route.params.incidentId}
            userId={userId}
            onBack={() => props.navigation.goBack()}
          />
        )}
      </ResponderStack.Screen>

      <ResponderStack.Screen name="ResponderHistory">
        {(props) => (
          <ResponderHistoryScreen
            userId={userId}
            onBack={() => props.navigation.goBack()}
          />
        )}
      </ResponderStack.Screen>
    </ResponderStack.Navigator>
  )
}

// ─── TL Stack ─────────────────────────────────────────────────────────────────
type TLParamList = {
  TLDashboard: undefined
  TLIncidentDetail: { incidentId: string }
  TLHistory: undefined
}

const TLStack = createNativeStackNavigator<TLParamList>()

function TLNavigator({ userId, orgId, fullName }: { userId: string; orgId: string; fullName: string | null }) {
  return (
    <TLStack.Navigator screenOptions={{ headerShown: false }}>
      <TLStack.Screen name="TLDashboard">
        {(props) => (
          <TLDashboardScreen
            userId={userId}
            orgId={orgId}
            fullName={fullName}
            onOpenIncident={(id) =>
              props.navigation.navigate('TLIncidentDetail', { incidentId: id })
            }
            onGoToHistory={() => props.navigation.navigate('TLHistory')}
          />
        )}
      </TLStack.Screen>

      <TLStack.Screen name="TLIncidentDetail">
        {(props) => (
          <TLIncidentDetailScreen
            incidentId={props.route.params.incidentId}
            tlUserId={userId}
            orgId={orgId}
            onBack={() => props.navigation.goBack()}
          />
        )}
      </TLStack.Screen>

      <TLStack.Screen name="TLHistory">
        {(props) => (
          <TLHistoryScreen
            orgId={orgId}
            onBack={() => props.navigation.goBack()}
          />
        )}
      </TLStack.Screen>
    </TLStack.Navigator>
  )
}

// ─── Web redirect screen for Super Admin ─────────────────────────────────────
function WebRedirectScreen({ role }: { role: string }) {
  return (
    <SafeAreaView style={styles.webRedirectContainer}>
      <Text style={styles.webRedirectTitle}>Guardian Dispatch</Text>
      <Text style={styles.webRedirectRole}>{role.replace('_', ' ').toUpperCase()}</Text>
      <Text style={styles.webRedirectText}>
        Your role uses the web dashboard. Please sign in at:
      </Text>
      <Text style={styles.webRedirectUrl}>guardian-dispatch.vercel.app</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// ─── Citizen Auth Flow ────────────────────────────────────────────────────────
type CitizenAuthView = 'register' | 'signin' | 'otp'

interface OtpContext {
  phone: string
  verificationId: string
  registrationData?: { fullName: string; email: string }
}

function CitizenAuthFlow({ onStaffLogin }: { onStaffLogin: () => void }) {
  const [view, setView] = useState<CitizenAuthView>('register')
  const [otpCtx, setOtpCtx] = useState<OtpContext | null>(null)

  if (view === 'otp' && otpCtx) {
    return (
      <CitizenOtpScreen
        phone={otpCtx.phone}
        verificationId={otpCtx.verificationId}
        registrationData={otpCtx.registrationData}
        onBack={() => setView(otpCtx.registrationData ? 'register' : 'signin')}
        onAuthenticated={() => {}}
      />
    )
  }

  if (view === 'signin') {
    return (
      <CitizenSignInScreen
        onContinue={(phone, verificationId) => {
          setOtpCtx({ phone, verificationId })
          setView('otp')
        }}
        onRegister={() => setView('register')}
        onStaffLogin={onStaffLogin}
      />
    )
  }

  return (
    <CitizenRegisterScreen
      onContinue={(data, verificationId) => {
        setOtpCtx({
          phone: data.phone,
          verificationId,
          registrationData: { fullName: data.fullName, email: data.email },
        })
        setView('otp')
      }}
      onSignIn={() => setView('signin')}
      onStaffLogin={onStaffLogin}
    />
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showStaffLogin, setShowStaffLogin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setShowStaffLogin(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    getCurrentProfile().then((p) => {
      setProfile(p)
      if (p?.id) {
        registerForPushNotifications(p.id)
      }
    })
  }, [session?.user?.id])

  // Still loading
  if (session === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    )
  }

  // Not logged in
  if (!session) {
    if (showStaffLogin) {
      return (
        <SafeAreaProvider>
          <NavigationContainer>
            <LoginScreen onLoginSuccess={() => {}} />
          </NavigationContainer>
        </SafeAreaProvider>
      )
    }
    return (
      <SafeAreaProvider>
        <CitizenAuthFlow onStaffLogin={() => setShowStaffLogin(true)} />
      </SafeAreaProvider>
    )
  }

  // Logged in — wait for profile
  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    )
  }

  if (profile.role === 'citizen' && !profile.phone_verified) {
    return (
      <SafeAreaProvider>
        <PhoneVerificationScreen
          onVerified={() => setProfile((prev) => prev ? { ...prev, phone_verified: true } : prev)}
        />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {profile.role === 'citizen' && <CitizenNavigator userId={session.user.id} />}
        {profile.role === 'responder' && <ResponderNavigator userId={session.user.id} />}
        {profile.role === 'team_leader' && (
          <TLNavigator
            userId={session.user.id}
            orgId={profile.organization_id ?? ''}
            fullName={profile.full_name}
          />
        )}
        {profile.role === 'super_admin' && (
          <WebRedirectScreen role={profile.role} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webRedirectContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  webRedirectTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  webRedirectRole: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 24,
  },
  webRedirectText: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  webRedirectUrl: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 40,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  signOutText: {
    color: '#6b7280',
    fontSize: 15,
  },
})
