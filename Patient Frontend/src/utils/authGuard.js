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
//
// Uses `replace`, not `navigate`: the guest is already standing on a screen
// they may not view, so Login must take its place in the stack. With `navigate`
// the gated screen stayed underneath and the header back button walked right
// back onto it — e.g. Doctor profile → Book Appointment → Login, then Back
// landed a signed-out visitor on the booking form.
export function useRequireLogin() {
  const navigation = useNavigation();
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await storage.getItem('userToken');
      if (!active || token) return;
      // replace() needs a screen beneath it; if this is the very first route
      // there is nothing to replace, so fall back to navigate.
      if (navigation.canGoBack()) navigation.replace('Login', { role: 'patient' });
      else navigation.navigate('Login', { role: 'patient' });
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
