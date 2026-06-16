import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tabs (after login)
function MainTabNavigator() {
  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Implants') iconName = focused ? 'medkit' : 'medkit-outline';
          else if (route.name === 'Cosmetic') iconName = focused ? 'happy' : 'happy-outline';
          else if (route.name === 'Orthodontics') iconName = focused ? 'options' : 'options-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0052FF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { paddingBottom: Platform.OS === 'ios' ? 20 : 24, paddingTop: 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Implants" component={ImplantsScreen} />
      <Tab.Screen name="Cosmetic" component={CosmeticScreen} />
      <Tab.Screen name="Orthodontics" component={OrthodonticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Doctor Tabs (after login as doctor)
function DoctorTabNavigator() {
  const { unreadChatCount } = useNotifications();
  const chatBadge = unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : undefined;

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
        tabBarActiveTintColor: '#0052FF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { paddingBottom: Platform.OS === 'ios' ? 20 : 24, paddingTop: 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' }
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

// Root Navigator
export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
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
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="PatientInbox" component={PatientInboxScreen} />
        {/* Hide default Search and Appointments screens from tabs, but make them accessible if needed */}
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
