import React from 'react';
import { ActivityIndicator, AppState, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import SplashScreen from '../screens/SplashScreen';
import NoticeScreen from '../screens/NoticeScreen';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import MapScreen from '../screens/MapScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PatientSetupScreen from '../screens/PatientSetupScreen';
import BookingScreen from '../screens/BookingScreen';
import DoctorProfileScreen from '../screens/DoctorProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ChatScreen from '../screens/ChatScreen';
import PatientInboxScreen from '../screens/PatientInboxScreen';
import PromoScreen from '../screens/PromoScreen';
import SavedDoctorsScreen from '../screens/SavedDoctorsScreen';
import PatientRewardsScreen from '../screens/PatientRewardsScreen';

// Doctor Screens
import DoctorHomeScreen from '../screens/doctor/DoctorHomeScreen';
import DoctorAppointmentsScreen from '../screens/doctor/DoctorAppointmentsScreen';
import DoctorPatientsScreen from '../screens/doctor/DoctorPatientsScreen';
import DoctorPatientDetailScreen from '../screens/doctor/DoctorPatientDetailScreen';
import DoctorAppointmentDetailScreen from '../screens/doctor/DoctorAppointmentDetailScreen';
import DoctorProfileScreenDoc from '../screens/doctor/DoctorProfileScreen';
import DoctorRegisterScreen from '../screens/doctor/DoctorRegisterScreen';
import ClinicSetupScreen from '../screens/doctor/ClinicSetupScreen';
import DoctorInboxScreen from '../screens/doctor/DoctorInboxScreen';
import DoctorBillsScreen from '../screens/doctor/DoctorBillsScreen';
import PointsHistoryScreen from '../screens/doctor/PointsHistoryScreen';

import ImplantsScreen from '../screens/ImplantsScreen';
import MyReviewsScreen from '../screens/MyReviewsScreen';
import CosmeticScreen from '../screens/CosmeticScreen';
import OrthodonticsScreen from '../screens/OrthodonticsScreen';
import BillsHistoryScreen from '../screens/BillsHistoryScreen';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import WebTopNav from '../components/WebTopNav';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { openWhatsApp } from '../utils/support';
import { drName } from '../utils/doctorName';

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
          else if (route.name === 'Rewards') iconName = focused ? 'gift' : 'gift-outline';
          else if (route.name === 'MyReviews') iconName = focused ? 'star' : 'star-outline';
          else if (route.name === 'Campaigns') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'BillsHistory') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        ...tabBarOptions,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Rewards" component={PatientRewardsScreen} />
      <Tab.Screen name="MyReviews" component={MyReviewsScreen} options={{ tabBarLabel: 'Reviews' }} />
      <Tab.Screen name="Campaigns" component={AppointmentsScreen} options={{ tabBarLabel: 'Appointments' }} />
      <Tab.Screen name="BillsHistory" component={BillsHistoryScreen} options={{ tabBarLabel: 'Bills' }} />
      {/* Profile, Cosmetic, Implants, Orthodontics are reachable from the top nav /
          search / treatment links, but hidden from the bottom bar. Profile sits in
          the top bar so it doesn't need a bottom tab. */}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Cosmetic" component={CosmeticScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Implants" component={ImplantsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Orthodontics" component={OrthodonticsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
    </Tab.Navigator>
  );
}

function DoctorAccessStatusScreen({ profile, navigation }) {
  const blocked = profile?.isBlocked;
  const rejected = profile?.approvalStatus === 'rejected';
  const platformFeeDue = Number(profile?.commissionDue || 0);
  const blockedForPlatformFee = blocked && platformFeeDue > 0;
  const title = blocked ? 'Account Blocked' : rejected ? 'Application Not Approved' : 'Pending Approval';
  const message = blocked
    ? (profile.blockReason || 'Your account has been blocked due to outstanding platform fee dues. Please clear your dues and contact support to restore access.')
    : rejected
    ? 'Your profile was not approved. Please contact support for details or to re-apply.'
    : 'Your profile is under review. An admin will approve your account shortly. You will get full access once approved.';
  const supportMessage = blockedForPlatformFee
    ? `Hello, I'm ${drName(profile.fullName, 'Doctor')}. My account is blocked because of outstanding platform fee dues of PKR ${platformFeeDue.toLocaleString()}. I have cleared / want to clear the dues. Please guide me and restore my access.`
    : `Hello, I'm Dr. ${profile?.fullName || ''}. Regarding my account ${blocked ? '(blocked)' : '(approval)'} - please assist.`;

  const logout = async () => {
    await storage.removeItem('userToken');
    await storage.removeItem('userRole');
    navigation.replace('Login');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#F8FAFC' }}>
      <View style={{ alignItems: 'center', width: '100%', maxWidth: 380 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: blocked ? '#FEE2E2' : '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name={blocked ? 'lock-closed' : rejected ? 'close-circle' : 'hourglass'} size={42} color={blocked ? '#DC2626' : rejected ? '#DC2626' : '#D97706'} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#0A1551', textAlign: 'center', marginBottom: 10 }}>{title}</Text>
        <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 22 }}>{message}</Text>

        {blockedForPlatformFee && (
          <View style={{ width: '100%', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 18, padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="warning-outline" size={18} color="#D97706" />
              <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '800', color: '#9A3412' }}>Platform Fee Payment Required</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12.5, color: '#9A3412', fontWeight: '600' }}>Outstanding Amount</Text>
              <Text style={{ fontSize: 13, color: '#9A3412', fontWeight: '900' }}>PKR {platformFeeDue.toLocaleString()}</Text>
            </View>
            <Text style={{ fontSize: 12.5, color: '#9A3412', lineHeight: 18 }}>
              Your dashboard access is paused until this platform fee is cleared and verified by My Dentist support. After payment, send your payment proof using the button below.
            </Text>
          </View>
        )}

        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#25D366', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999 }} onPress={() => openWhatsApp(supportMessage)}>
          <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Contact Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={logout}>
          <Text style={{ color: '#64748B', fontWeight: '600' }}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Doctor Tabs (after login as doctor)
function DoctorTabNavigator({ navigation }) {
  const { unreadChatCount } = useNotifications();
  const chatBadge = unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : undefined;
  const tabBarOptions = useTabBarOptions();
  const [gateLoading, setGateLoading] = React.useState(true);
  const [doctorProfile, setDoctorProfile] = React.useState(null);

  const loadAccess = React.useCallback(async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) {
        navigation.replace('Login');
        return;
      }
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setDoctorProfile(res.data.data?.profile || null);
    } catch {
      // Let existing screens show their own network/auth state if the check fails.
    } finally {
      setGateLoading(false);
    }
  }, [navigation]);

  React.useEffect(() => {
    loadAccess();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadAccess();
    });
    return () => sub.remove();
  }, [loadAccess]);

  if (gateLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  if (doctorProfile && (doctorProfile.isBlocked || doctorProfile.approvalStatus === 'rejected' || doctorProfile.approvalStatus === 'pending')) {
    return <DoctorAccessStatusScreen profile={doctorProfile} navigation={navigation} />;
  }

  return (
    <Tab.Navigator
      screenListeners={{ tabPress: loadAccess }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'DoctorHome') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Appointments') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Patients') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'DoctorBills') iconName = focused ? 'receipt' : 'receipt-outline';
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
      <Tab.Screen name="DoctorBills" component={DoctorBillsScreen} options={{ tabBarLabel: 'Bills' }} />
      {/* Inbox + Profile are reachable from the top header (chat icon / avatar),
          so they're hidden from the bottom bar. */}
      <Tab.Screen name="Inbox" component={DoctorInboxScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Profile" component={DoctorProfileScreenDoc} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      {/* Detail screen lives INSIDE the tabs (hidden button) so the bottom nav
          stays visible while viewing an appointment on small devices. */}
      <Tab.Screen name="DoctorAppointmentDetail" component={DoctorAppointmentDetailScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
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
        {/* The marketing banner is shown in-screen via <PromoCard /> on every
            patient screen (web + phone). No separate top strip — that caused a
            duplicate banner on web. */}
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
        <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
        <Stack.Screen name="DoctorPatientDetail" component={DoctorPatientDetailScreen} />
        {/* DoctorAppointmentDetail now lives inside DoctorTabs (keeps bottom nav). */}
        <Stack.Screen name="Promo" component={PromoScreen} />
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="PatientInbox" component={PatientInboxScreen} />
        {/* Hide default Search and Appointments screens from tabs, but make them accessible if needed */}
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="SavedDoctors" component={SavedDoctorsScreen} />
        <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
      </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}
