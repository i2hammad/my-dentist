import { Platform, Alert } from 'react-native';

/**
 * Detect precise GPS coordinates. Native uses expo-location (with permission
 * prompt); web uses the browser geolocation API. Calls onResult("lat, lng").
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
      done(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
      return;
    }
    const geo = (typeof navigator !== 'undefined' && navigator.geolocation) ? navigator.geolocation : null;
    if (!geo) { done(null); window.alert('Location not available. Please type your location manually.'); return; }
    geo.getCurrentPosition(
      (pos) => done(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
      (err) => { done(null); window.alert(err?.code === 1 ? 'Location permission denied.' : 'Could not get location.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } catch (e) {
    done(null);
    Alert.alert('Location', 'Could not get your location. Please type it manually.');
  }
}
