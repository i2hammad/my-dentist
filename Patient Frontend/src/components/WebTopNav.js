import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';

// Top navigation bar used on the WEB build (all widths) in place of the bottom
// tab bar. Renders: brand (left) · tab links (center) · notifications + profile
// (right). Native keeps the default bottom tabs — this is only wired on web.
//
// Used as a custom `tabBar` for the patient/doctor tab navigators. The label +
// icon come from each route's descriptor options. The right-hand profile button
// activates the route named "Profile" so it stays in sync with the tabs.
export default function WebTopNav({ state, descriptors, navigation }) {
  const { unreadChatCount = 0, unreadCount = 0 } = useNotifications() || {};

  // Is this the patient navigator? (has a Home tab). Doctors don't get the
  // patient-only quick actions (appointments/inbox/notifications stack routes).
  const isPatient = state.routes.some((r) => r.name === 'Home');
  const goStack = (name) => navigation.navigate(name);

  const onPress = (route, isFocused) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  // Split the profile tab out to the right cluster; the rest stay centered.
  const profileRoute = state.routes.find((r) => r.name === 'Profile');
  const navRoutes = state.routes.filter((r) => r.name !== 'Profile');

  const iconFor = (descriptor, route, focused) => {
    const opt = descriptor.options;
    if (typeof opt.tabBarIcon === 'function') {
      return opt.tabBarIcon({ focused, color: focused ? '#0052FF' : '#64748B', size: 20 });
    }
    return <Ionicons name="ellipse-outline" size={20} color={focused ? '#0052FF' : '#64748B'} />;
  };
  const labelFor = (descriptor, route) => {
    const opt = descriptor.options;
    if (typeof opt.tabBarLabel === 'string') return opt.tabBarLabel;
    if (typeof opt.title === 'string') return opt.title;
    return route.name;
  };

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        {/* Brand */}
        <Pressable
          style={styles.brand}
          onPress={() => navigation.navigate(navRoutes[0]?.name || state.routes[0].name)}
        >
          <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}>My Dentist <Text style={styles.brandAccent}>PK</Text></Text>
        </Pressable>

        {/* Tab links */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.links}>
          {navRoutes.map((route) => {
            const descriptor = descriptors[route.key];
            const isFocused = state.routes[state.index].key === route.key;
            return (
              <Pressable
                key={route.key}
                onPress={() => onPress(route, isFocused)}
                style={[styles.link, isFocused && styles.linkActive]}
              >
                {iconFor(descriptor, route, isFocused)}
                <Text style={[styles.linkText, isFocused && styles.linkTextActive]}>
                  {labelFor(descriptor, route)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Right cluster: quick actions + profile */}
        <View style={styles.right}>
          {isPatient && (
            <>
              <Pressable style={styles.iconBtn} onPress={() => goStack('Appointments')}>
                <Ionicons name="calendar-outline" size={22} color="#334155" />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => goStack('PatientInbox')}>
                <Ionicons name="chatbubbles-outline" size={22} color="#334155" />
                {unreadChatCount > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text></View>
                )}
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => goStack('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color="#334155" />
                {unreadCount > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>
                )}
              </Pressable>
            </>
          )}
          {profileRoute && (() => {
            const descriptor = descriptors[profileRoute.key];
            const isFocused = state.routes[state.index].key === profileRoute.key;
            const badge = descriptor.options.tabBarBadge;
            return (
              <Pressable
                onPress={() => onPress(profileRoute, isFocused)}
                style={[styles.profileBtn, isFocused && styles.profileBtnActive]}
              >
                <Ionicons name="person-circle-outline" size={24} color={isFocused ? '#0052FF' : '#334155'} />
                <Text style={[styles.profileText, isFocused && styles.linkTextActive]}>Profile</Text>
                {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
              </Pressable>
            );
          })()}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 2px 12px rgba(15,23,42,0.05)' } : {}),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    gap: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brandText: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  brandAccent: { color: '#0052FF' },

  links: { flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1, justifyContent: 'center' },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  linkActive: { backgroundColor: '#EFF4FF' },
  linkText: { fontSize: 14.5, fontWeight: '600', color: '#64748B' },
  linkTextActive: { color: '#0052FF' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { position: 'relative', padding: 8, borderRadius: 10 },
  profileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  profileBtnActive: { borderColor: '#0052FF', backgroundColor: '#EFF4FF' },
  profileText: { fontSize: 14, fontWeight: '600', color: '#334155' },

  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444',
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
