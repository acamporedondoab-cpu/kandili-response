import * as Location from 'expo-location'

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  const granted = await requestLocationPermission()
  if (!granted) return null

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    }
  } catch (err) {
    console.error('[location] getCurrentLocation failed:', err)
    return null
  }
}

// Returns barangay-level display string: "Brgy. Calumpang, General Santos City"
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    if (results.length === 0) return null
    const r = results[0]
    const barangay = r.district ? `Brgy. ${r.district}` : null
    const city = r.city ?? r.subregion ?? ''
    if (barangay && city) return `${barangay}, ${city}`
    if (barangay) return barangay
    const region = r.region ?? ''
    if (city && region) return `${city}, ${region}`
    return city || region || null
  } catch {
    return null
  }
}

// Returns normalized barangay name for org matching (lowercase, no prefix)
// e.g. "Barangay Calumpang" → "calumpang", "Brgy. Fatima" → "fatima"
// Returns null if barangay cannot be determined (triggers distance fallback)
export async function getBarangay(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    if (results.length === 0) return null
    const raw = results[0].district ?? null
    if (!raw) return null
    const normalized = raw
      .toLowerCase()
      .trim()
      .replace(/^(barangay|brgy\.|brgy|bgy\.)\s*/i, '')
      .trim()
    return normalized || null
  } catch {
    return null
  }
}
