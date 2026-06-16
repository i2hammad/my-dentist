/**
 * API base URL configuration.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL  — set this in .env for dev/staging/production
 *  2. Automatic per-platform localhost fallback for local development
 *
 * For production: set EXPO_PUBLIC_API_URL=https://api.yourdomain.com in .env
 * For ngrok dev:  set EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.dev in .env
 */
import { Platform } from 'react-native';

// Expo SDK 49+ reads EXPO_PUBLIC_* from .env automatically
const envUrl = process.env.EXPO_PUBLIC_API_URL;

const getDefaultUrl = () => {
  if (Platform.OS === 'android') {
    // Android emulator maps 10.0.2.2 to host loopback
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

const API_BASE_URL = envUrl || getDefaultUrl();

export default API_BASE_URL;
