import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ScrollView, BackHandler } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { NotificationProvider } from './src/context/NotificationContext';

// Mock deprecated/removed BackHandler.removeEventListener to prevent older packages from crashing the app
if (BackHandler && !BackHandler.removeEventListener) {
  BackHandler.removeEventListener = () => {};
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
          <AppNavigator />
          <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
        </NotificationProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
