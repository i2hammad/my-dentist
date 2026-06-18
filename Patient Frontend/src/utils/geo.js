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
 * Detect the user's precise location and return BOTH a readable address and the
 * raw coordinates.
 *
 *   detectCoords(onResult, onBusy)
 *     onResult(value)  // backwards-compatible string (address, or "lat, lng")
 *                      // AND a second arg: { address, coords: "lat, lng", latitude, longitude }
 *     onBusy(boolean)  // toggles a loading spinner
 *
 * Callers can either use the first string arg as before, or read the details
 * object for both the address and the coordinates.
 */
export async function detectCoords(onResult, onBusy) {
  onBusy && onBusy(true);
  const finish = (address, latitude, longitude) => {
    onBusy && onBusy(false);
    if (latitude == null) { if (address) onResult(address); return; }
    const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    const text = address || coords;
    onResult(text, { address: address || '', coords, latitude, longitude });
  };

  try {
    if (Platform.OS !== 'web') {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        onBusy && onBusy(false);
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
      finish(address, latitude, longitude);
      return;
    }

    // Web
    const geo = (typeof navigator !== 'undefined' && navigator.geolocation) ? navigator.geolocation : null;
    if (!geo) { onBusy && onBusy(false); window.alert('Location not available. Please type your location manually.'); return; }
    geo.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const address = await webReverseGeocode(latitude, longitude);
        finish(address, latitude, longitude);
      },
      (err) => { onBusy && onBusy(false); window.alert(err?.code === 1 ? 'Location permission denied.' : 'Could not get location.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } catch (e) {
    onBusy && onBusy(false);
    Alert.alert('Location', 'Could not get your location. Please type it manually.');
  }
}
