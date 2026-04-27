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
import type { MediaItem } from './lib/media'

// Screens
import LoginScreen from './screens/auth/LoginScreen'
import CitizenRegisterScreen from './screens/citizen/CitizenRegisterScreen'
import CitizenOtpScreen from './screens/citizen/CitizenOtpScreen'
import CitizenSignInScreen from './screens/citizen/CitizenSignInScreen'
import HomeScreen from './screens/citizen/HomeScreen'
import CountdownScreen from './screens/citizen/CountdownScreen'
import ActiveIncidentScreen from './screens/citizen/ActiveIncidentScreen'
import CitizenHistoryScreen from './screens/citizen/CitizenHistoryScreen'
import ProfileScreen from './screens/citizen/ProfileScreen'
import DutyScreen from './screens/responder/DutyScreen'
import IncidentScreen from './screens/responder/IncidentScreen'
import ResponderHistoryScreen from './screens/responder/ResponderHistoryScreen'
import ResponderProfileScreen from './screens/responder/ResponderProfileScreen'
import TLDashboardScreen from './screens/tl/TLDashboardScreen'
import TLIncidentDetailScreen from './screens/tl/TLIncidentDetailScreen'
import TLHistoryScreen from './screens/tl/TLHistoryScreen'
import TLProfileScreen from './screens/tl/TLProfileScreen'
import PhoneVerificationScreen from './screens/citizen/PhoneVerificationScreen'

// ─── Citizen Stack ────────────────────────────────────────────────────────────
type CitizenParamList = {
  Home: undefined
  Countdown: { emergencyType: EmergencyType; pendingMedia: MediaItem[] }
  ActiveIncident: { incidentId: string; userId: string; pendingMedia?: MediaItem[] }
  CitizenHistory: undefined
  Profile: undefined
}

const CitizenStack = createNativeStackNavigator<CitizenParamList>()

function CitizenNavigator({ userId, profile, onProfileUpdated }: {
  userId: string
  profile: Profile | null
  onProfileUpdated: (updated: Partial<Profile>) => void
}) {
  return (
    <CitizenStack.Navigator screenOptions={{ headerShown: false }}>
      <CitizenStack.Screen name="Home">
        {(props) => (
          <HomeScreen
            userId={userId}
            profile={profile}
            onSosDispatched={(type: EmergencyType, pendingMedia: MediaItem[]) =>
              props.navigation.navigate('Countdown', { emergencyType: type, pendingMedia })
            }
            onGoToActiveIncident={(id) =>
              props.navigation.navigate('ActiveIncident', { incidentId: id, userId })
            }
            onGoToHistory={() => props.navigation.navigate('CitizenHistory')}
            onGoToProfile={() => props.navigation.navigate('Profile')}
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
                props.navigation.replace('ActiveIncident', {
                  incidentId: id,
                  userId,
                  pendingMedia: props.route.params.pendingMedia,
                })
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
            userId={props.route.params.userId}
            pendingMedia={props.route.params.pendingMedia}
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

      <CitizenStack.Screen name="Profile">
        {(props) => profile ? (
          <ProfileScreen
            profile={profile}
            onBack={() => props.navigation.goBack()}
            onProfileUpdated={onProfileUpdated}
          />
        ) : null}
      </CitizenStack.Screen>
    </CitizenStack.Navigator>
  )
}

// ─── Responder Stack ──────────────────────────────────────────────────────────
type ResponderParamList = {
  Duty: undefined
  Incident: { incidentId: string }
  ResponderHistory: undefined
  ResponderProfile: undefined
}

const ResponderStack = createNativeStackNavigator<ResponderParamList>()

function ResponderNavigator({ userId, profile, onProfileUpdated }: {
  userId: string
  profile: Profile | null
  onProfileUpdated: (updated: Partial<Profile>) => void
}) {
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
            onGoToProfile={() => props.navigation.navigate('ResponderProfile')}
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

      <ResponderStack.Screen name="ResponderProfile">
        {(props) => profile ? (
          <ResponderProfileScreen
            profile={profile}
            onBack={() => props.navigation.goBack()}
            onProfileUpdated={onProfileUpdated}
          />
        ) : null}
      </ResponderStack.Screen>
    </ResponderStack.Navigator>
  )
}

// ─── TL Stack ─────────────────────────────────────────────────────────────────
type TLParamList = {
  TLDashboard: undefined
  TLIncidentDetail: { incidentId: string }
  TLHistory: undefined
  TLProfile: undefined
}

const TLStack = createNativeStackNavigator<TLParamList>()

function TLNavigator({ userId, orgId, profile, onProfileUpdated }: {
  userId: string
  orgId: string
  profile: Profile | null
  onProfileUpdated: (updated: Partial<Profile>) => void
}) {
  return (
    <TLStack.Navigator screenOptions={{ headerShown: false }}>
      <TLStack.Screen name="TLDashboard">
        {(props) => (
          <TLDashboardScreen
            userId={userId}
            orgId={orgId}
            profile={profile}
            onOpenIncident={(id) =>
              props.navigation.navigate('TLIncidentDetail', { incidentId: id })
            }
            onGoToHistory={() => props.navigation.navigate('TLHistory')}
            onGoToProfile={() => props.navigation.navigate('TLProfile')}
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

      <TLStack.Screen name="TLProfile">
        {(props) => profile ? (
          <TLProfileScreen
            profile={profile}
            onBack={() => props.navigation.goBack()}
            onProfileUpdated={onProfileUpdated}
          />
        ) : null}
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
        {profile.role === 'citizen' && (
          <CitizenNavigator
            userId={session.user.id}
            profile={profile}
            onProfileUpdated={(updated) => setProfile((prev) => prev ? { ...prev, ...updated } : prev)}
          />
        )}
        {profile.role === 'responder' && (
          <ResponderNavigator
            userId={session.user.id}
            profile={profile}
            onProfileUpdated={(updated) => setProfile((prev) => prev ? { ...prev, ...updated } : prev)}
          />
        )}
        {profile.role === 'team_leader' && (
          <TLNavigator
            userId={session.user.id}
            orgId={profile.organization_id ?? ''}
            profile={profile}
            onProfileUpdated={(updated) => setProfile((prev) => prev ? { ...prev, ...updated } : prev)}
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
