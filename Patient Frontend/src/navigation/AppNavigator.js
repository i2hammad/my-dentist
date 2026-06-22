import React from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import SplashScreen from '../screens/SplashScreen';
import NoticeScreen from '../screens/NoticeScreen';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PatientSetupScreen from '../screens/PatientSetupScreen';
import BookingScreen from '../screens/BookingScreen';
import DoctorProfileScreen from '../screens/DoctorProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ChatScreen from '../screens/ChatScreen';
import PatientInboxScreen from '../screens/PatientInboxScreen';
import PromoScreen from '../screens/PromoScreen';
import SavedDoctorsScreen from '../screens/SavedDoctorsScreen';

// Doctor Screens
import DoctorHomeScreen from '../screens/doctor/DoctorHomeScreen';
import DoctorAppointmentsScreen from '../screens/doctor/DoctorAppointmentsScreen';
import DoctorPatientsScreen from '../screens/doctor/DoctorPatientsScreen';
import DoctorProfileScreenDoc from '../screens/doctor/DoctorProfileScreen';
import DoctorRegisterScreen from '../screens/doctor/DoctorRegisterScreen';
import ClinicSetupScreen from '../screens/doctor/ClinicSetupScreen';
import DoctorInboxScreen from '../screens/doctor/DoctorInboxScreen';

import ImplantsScreen from '../screens/ImplantsScreen';
import CosmeticScreen from '../screens/CosmeticScreen';
import OrthodonticsScreen from '../screens/OrthodonticsScreen';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import WebTopNav from '../components/WebTopNav';

// On web, a single root-level top navbar (WebTopNav, rendered above the stack)
// handles all navigation, so the per-navigator tab bars are hidden. Native keeps
// the default bottom tabs.
const isWeb = Platform.OS === 'web';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab bar styling shared by patient + doctor navigators.
function useTabBarOptions() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (isWeb && width >= 1024) {
    // Wide web: the top WebTopNav shows the nav links, so hide the bottom tabs.
    // Narrow web keeps the bottom tab bar (the top links are hidden there).
    return { tabBarStyle: { display: 'none' } };
  }
  // Web has no gesture nav bar, so no safe-area inset is needed there — adding it
  // pushes the labels into the rounded container and clips them. Native keeps the
  // inset (min 8) so labels clear the device gesture bar.
  const bottomInset = isWeb ? 10 : Math.max(insets.bottom, 8);
  return {
    tabBarPosition: 'bottom',
    tabBarActiveTintColor: '#0052FF',
    tabBarInactiveTintColor: '#94A3B8',
    tabBarStyle: {
      height: 64 + bottomInset,
      paddingBottom: bottomInset,
      paddingTop: 8,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
    },
    tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600', marginBottom: 4, includeFontPadding: false },
    tabBarIconStyle: { marginTop: 2 },
  };
}

// Main Tabs (after login)
function MainTabNavigator() {
  const tabBarOptions = useTabBarOptions();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Implants') iconName = focused ? 'medkit' : 'medkit-outline';
          else if (route.name === 'Campaigns') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Orthodontics') iconName = focused ? 'options' : 'options-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        ...tabBarOptions,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Implants" component={ImplantsScreen} />
      <Tab.Screen name="Campaigns" component={AppointmentsScreen} options={{ tabBarLabel: 'Appointments' }} />
      <Tab.Screen name="Orthodontics" component={OrthodonticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Doctor Tabs (after login as doctor)
function DoctorTabNavigator() {
  const { unreadChatCount } = useNotifications();
  const chatBadge = unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : undefined;
  const tabBarOptions = useTabBarOptions();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'DoctorHome') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Appointments') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Patients') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Inbox') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          else iconName = 'ellipse';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        ...tabBarOptions,
      })}
    >
      <Tab.Screen name="DoctorHome" component={DoctorHomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Appointments" component={DoctorAppointmentsScreen} />
      <Tab.Screen name="Patients" component={DoctorPatientsScreen} />
      <Tab.Screen name="Inbox" component={DoctorInboxScreen} options={{ tabBarBadge: chatBadge }} />
      <Tab.Screen name="Profile" component={DoctorProfileScreenDoc} />
    </Tab.Navigator>
  );
}

// Deep Linking Configuration
const linking = {
  prefixes: ['mydentist://', 'https://medapp.com'],
  config: {
    screens: {
      DoctorProfile: 'doctor/:doctorId',
    },
  },
};

// Extract the active root route name + (if it's a tab navigator) the focused
// tab name from a navigation state object.
function readNavInfo(state) {
  if (!state) return { root: null, tab: null };
  const route = state.routes[state.index];
  let tab = null;
  if (route.state && Array.isArray(route.state.routes)) {
    const inner = route.state.routes[route.state.index ?? 0];
    tab = inner?.name || null;
  }
  return { root: route.name, tab };
}

// Root Navigator
export default function AppNavigator() {
  const navRef = useNavigationContainerRef();
  const [navInfo, setNavInfo] = React.useState({ root: null, tab: null });
  const syncNavInfo = React.useCallback(() => {
    try { setNavInfo(readNavInfo(navRef.getRootState())); } catch {}
  }, [navRef]);

  return (
    <NavigationContainer
      ref={navRef}
      linking={linking}
      onReady={isWeb ? syncNavInfo : undefined}
      onStateChange={isWeb ? syncNavInfo : undefined}
    >
      <View style={{ flex: 1 }}>
        {isWeb && <WebTopNav navRef={navRef} navInfo={navInfo} />}
        <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Notice" component={NoticeScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="PatientSetup" component={PatientSetupScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="DoctorTabs" component={DoctorTabNavigator} />
        <Stack.Screen name="DoctorRegister" component={DoctorRegisterScreen} />
        <Stack.Screen name="ClinicSetup" component={ClinicSetupScreen} />
        <Stack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
        <Stack.Screen name="Promo" component={PromoScreen} />
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="PatientInbox" component={PatientInboxScreen} />
        {/* Hide default Search and Appointments screens from tabs, but make them accessible if needed */}
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="SavedDoctors" component={SavedDoctorsScreen} />
      </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}
