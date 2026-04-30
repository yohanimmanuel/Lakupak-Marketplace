import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  language: 'laku.preferences.language',
  pushEnabled: 'laku.preferences.pushEnabled',
} as const;

export type AppLanguage = 'id' | 'en';

export async function getPreferredLanguage(): Promise<AppLanguage | null> {
  try {
    const v = await AsyncStorage.getItem(KEYS.language);
    if (v === 'id' || v === 'en') return v;
    return null;
  } catch {
    return null;
  }
}

export async function setPreferredLanguage(lang: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.language, lang);
  } catch {
    // ignore
  }
}

export async function getPushNotificationsEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEYS.pushEnabled);
    if (v == null) return true; // default ON
    return v === 'true';
  } catch {
    return true;
  }
}

export async function setPushNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.pushEnabled, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

