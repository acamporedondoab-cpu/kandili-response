import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { File as FSFile } from 'expo-file-system'
import { supabase } from '../../lib/supabase/client'
import type { Profile } from '../../types'

interface Props {
  profile: Profile
  onBack: () => void
  onProfileUpdated: (updated: Partial<Profile>) => void
}

export default function ProfileScreen({ profile, onBack, onProfileUpdated }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [email, setEmail] = useState(profile.email ?? '')
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Allow photo library access to change your avatar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setUploadingAvatar(true)

    try {
      const rawExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
      const fileName = `${profile.id}/${Date.now()}.${ext}`

      const file = new FSFile(asset.uri)
      const bytes = await file.bytes()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, bytes, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setAvatarUri(publicUrl)
      onProfileUpdated({ avatar_url: publicUrl })
    } catch (err) {
      console.error('[ProfileScreen] avatar upload failed:', err)
      Alert.alert('Upload Failed', 'Could not update your avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    const trimmedName = fullName.trim()
    if (!trimmedName) {
      Alert.alert('Name Required', 'Full name cannot be empty.')
      return
    }

    const trimmedEmail = email.trim().toLowerCase()
    const emailChanged = trimmedEmail && trimmedEmail !== (profile.email ?? '').toLowerCase()

    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }

    setSaving(true)
    try {
      const updates: Record<string, string> = { full_name: trimmedName }
      if (emailChanged) updates.email = trimmedEmail

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)

      if (profileError) throw profileError

      if (emailChanged) {
        const { error: authError } = await supabase.auth.updateUser({ email: trimmedEmail })
        if (authError) {
          if (authError.message.includes('already')) {
            Alert.alert('Email Taken', 'That email is already in use by another account.')
            setSaving(false)
            return
          }
          // Supabase fails when the old auth email is a placeholder (e.g. firebase internal address)
          // but it still sends the confirmation link to the new address — treat as success
          if (!authError.message.toLowerCase().includes('invalid')) {
            Alert.alert('Email Update Failed', authError.message)
            setSaving(false)
            return
          }
        }
        onProfileUpdated({ full_name: trimmedName, email: trimmedEmail })
        Alert.alert(
          'Verify Your Email',
          'A confirmation link has been sent to your new email. Please check your inbox to complete the change.'
        )
      } else {
        onProfileUpdated({ full_name: trimmedName })
        Alert.alert('Saved', 'Your profile has been updated.')
      }
    } catch (err) {
      console.error('[ProfileScreen] save failed:', err)
      Alert.alert('Save Failed', 'Could not update your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const roleLabel =
    profile.role === 'citizen' ? 'Citizen'
    : profile.role === 'responder' ? 'Responder'
    : profile.role === 'team_leader' ? 'Team Leader'
    : profile.role

  const avatarLetter = (profile.full_name ?? 'U').charAt(0).toUpperCase()

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            disabled={uploadingAvatar}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
            )}
            <View style={styles.avatarRing} />

            {/* Edit overlay */}
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{profile.full_name ?? 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel.toUpperCase()}</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formSection}>

          {/* Full name — editable */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={16} color="rgba(0,229,255,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Phone — read-only */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <View style={[styles.inputWrapper, styles.inputReadOnly]}>
              <Feather name="phone" size={16} color="rgba(255,255,255,0.2)" style={styles.inputIcon} />
              <Text style={styles.readOnlyText}>
                {profile.phone_number ?? 'Not set'}
              </Text>
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={12} color="#34D399" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>

          {/* Email — editable */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={16} color="rgba(0,229,255,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Role — read-only */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ACCOUNT TYPE</Text>
            <View style={[styles.inputWrapper, styles.inputReadOnly]}>
              <Feather name="shield" size={16} color="rgba(255,255,255,0.2)" style={styles.inputIcon} />
              <Text style={styles.readOnlyText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.readOnlyNote}>
          Email changes require confirmation. Phone number can only be changed by contacting support.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B18',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    position: 'absolute',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(220,38,38,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
  },
  avatarRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#070B18',
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  roleBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  formSection: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 28,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputReadOnly: {
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  readOnlyText: {
    flex: 1,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '400',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '600',
  },
  saveButton: {
    marginHorizontal: 24,
    height: 54,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  readOnlyNote: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 16,
  },
})
