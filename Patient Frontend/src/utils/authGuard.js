import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
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
// (Rewards, Appointments, Bills, Inbox, Saved…). Call at the top of the screen.
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
