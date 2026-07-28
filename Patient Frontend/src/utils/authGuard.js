import { useEffect, useState } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import storage from '../config/storage';

// Guest browsing: visitors can search/view dentists without an account, but
// account actions (book, favorite, chat) and account screens require login.

// Action gate — call at an action's entry point. Returns true if signed in;
// otherwise sends the visitor to patient Login and returns false.
export async function ensureAuth(navigation) {
  const token = await storage.getItem('userToken');
  if (token) return true;
  navigation.navigate('Login', { role: 'patient' });
  return false;
}

// Screen gate — bounce guests to Login when a whole screen needs an account
// (Inbox, Saved, Notifications…). Call at the top of the screen. Prefer
// `useIsGuest()` + <GuestGate/> for tab screens so the tab stays usable.
export function useRequireLogin() {
  const navigation = useNavigation();
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await storage.getItem('userToken');
      if (active && !token) navigation.navigate('Login', { role: 'patient' });
    })();
    return () => { active = false; };
  }, []);
}

// Guest state for tab screens that render a <GuestGate/> instead of redirecting.
// Re-checks on focus so it flips to false right after the user logs in.
export function useIsGuest() {
  const [isGuest, setIsGuest] = useState(false);
  useFocusEffect(
    require('react').useCallback(() => {
      let active = true;
      (async () => {
        const token = await storage.getItem('userToken');
        if (active) setIsGuest(!token);
      })();
      return () => { active = false; };
    }, [])
  );
  return isGuest;
}
