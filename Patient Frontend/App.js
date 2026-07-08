import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ScrollView, BackHandler, Platform } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { NotificationProvider } from './src/context/NotificationContext';
import './src/config/alertOverride'; // route Alert.alert through the branded dialog
import AppDialog from './src/components/AppDialog';
import ImpersonationBanner from './src/components/ImpersonationBanner';

// Mock deprecated/removed BackHandler.removeEventListener to prevent older packages from crashing the app
if (BackHandler && !BackHandler.removeEventListener) {
  BackHandler.removeEventListener = () => {};
}

// Web: show a slim right-side scrollbar. The app's ScrollViews set
// showsVerticalScrollIndicator={false} (right for native touch), which also
// hides the bar on web — this re-enables a styled scrollbar globally without
// editing every screen. No effect on native.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    * { scrollbar-width: thin !important; scrollbar-color: #c3cfe0 transparent; }
    *::-webkit-scrollbar { display: block !important; width: 10px; height: 10px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: #c3cfe0; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
    *::-webkit-scrollbar-thumb:hover { background: #a3b4cc; background-clip: padding-box; }
  `;
  document.head.appendChild(style);
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View style={{ flex: 1, paddingTop: 50, paddingHorizontal: 20, backgroundColor: '#fff' }}>
            <Text style={{ fontSize: 22, color: 'red', fontWeight: 'bold' }}>App Crashed!</Text>
            <ScrollView style={{ marginTop: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Error:</Text>
              <Text style={{ color: 'red', marginBottom: 20 }}>{this.state.error?.toString()}</Text>
              
              <Text style={{ fontWeight: 'bold' }}>Component Stack:</Text>
              <Text style={{ fontSize: 12 }}>{this.state.errorInfo?.componentStack}</Text>
            </ScrollView>
          </View>
        </SafeAreaProvider>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NotificationProvider>
          {/* Banner sits above the navigator in flow so it pushes the app down
              (was absolute → overlapped the header). Renders null when inactive. */}
          <View style={{ flex: 1 }}>
            <ImpersonationBanner />
            <AppNavigator />
          </View>
          <AppDialog />
          <StatusBar style="dark" translucent backgroundColor="transparent" />
        </NotificationProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
