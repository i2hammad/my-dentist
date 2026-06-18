import { Platform, Alert } from 'react-native';

// Turn an expo-location reverse-geocode result into a readable one-line address.
function formatNativeAddress(a) {
  if (!a) return null;
  const parts = [
    a.name && a.name !== a.street ? a.name : null,
    a.street,
    a.district,
    a.subregion || a.city,
    a.region,
  ].filter(Boolean);
  // De-duplicate consecutive repeats (expo often repeats city/region).
  const seen = new Set();
  const clean = parts.filter((p) => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return clean.length ? clean.join(', ') : null;
}

// Reverse-geocode coordinates to a readable address on web via OpenStreetMap.
async function webReverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Detect the user's precise location and return a READABLE ADDRESS (not raw
 * coordinates). Falls back to "lat, lng" only if reverse geocoding fails.
 *
 *   detectCoords(onResult, onBusy)
 *     onResult(address: string)   // human-readable address, e.g. "F-7 Markaz, Islamabad"
 *     onBusy(boolean)             // toggles a loading spinner
 */
export async function detectCoords(onResult, onBusy) {
  onBusy && onBusy(true);
  const done = (v) => { onBusy && onBusy(false); if (v) onResult(v); };

  try {
    if (Platform.OS !== 'web') {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        done(null);
        Alert.alert('Permission needed', 'Location permission was denied. You can type your location manually instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      let address = null;
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        address = formatNativeAddress(results && results[0]);
      } catch { /* fall back to coords */ }
      done(address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      return;
    }

    // Web
    const geo = (typeof navigator !== 'undefined' && navigator.geolocation) ? navigator.geolocation : null;
    if (!geo) { done(null); window.alert('Location not available. Please type your location manually.'); return; }
    geo.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const address = await webReverseGeocode(latitude, longitude);
        done(address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      },
      (err) => { done(null); window.alert(err?.code === 1 ? 'Location permission denied.' : 'Could not get location.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } catch (e) {
    done(null);
    Alert.alert('Location', 'Could not get your location. Please type it manually.');
  }
}
