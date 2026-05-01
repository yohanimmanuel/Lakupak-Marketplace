import AsyncStorage from '@react-native-async-storage/async-storage';

/** Legacy global keys (pre per-user storage). */
const LEGACY = {
  language: 'laku.preferences.language',
  pushEnabled: 'laku.preferences.pushEnabled',
} as const;

const v2 = {
  language: (scope: string) => `laku.preferences.v2.language.${scope}`,
  pushEnabled: (scope: string) => `laku.preferences.v2.pushEnabled.${scope}`,
} as const;

/** Last language applied in the app (settings or resolved account). Used for welcome/login/signup when logged out. */
const LANGUAGE_MOST_RECENT = 'laku.preferences.v2.language.mostRecent';

export type AppLanguage = 'id' | 'en';

export function preferenceScopeFromUserId(userId: number | null): string {
  return userId != null ? `u${userId}` : 'guest';
}

export async function getMostRecentlySetOrAppliedLanguage(): Promise<AppLanguage | null> {
  try {
    const v = await AsyncStorage.getItem(LANGUAGE_MOST_RECENT);
    if (v === 'id' || v === 'en') return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Language for logged-out flows (welcome, login, signup): last explicit/resolved choice, then guest/legacy.
 */
export async function getLanguageForPublicOrGuestSession(): Promise<AppLanguage | null> {
  const recent = await getMostRecentlySetOrAppliedLanguage();
  if (recent) return recent;
  return getPreferredLanguage(null);
}

export async function syncAppliedLanguageForDevice(lang: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_MOST_RECENT, lang);
  } catch {
    // ignore
  }
}

export async function getPreferredLanguage(userId: number | null = null): Promise<AppLanguage | null> {
  try {
    const scope = preferenceScopeFromUserId(userId);
    const v = await AsyncStorage.getItem(v2.language(scope));
    if (v === 'id' || v === 'en') return v;

    // Guest: fall back to legacy single-device preference once, then persist to guest scope.
    if (scope === 'guest') {
      const legacy = await AsyncStorage.getItem(LEGACY.language);
      if (legacy === 'id' || legacy === 'en') {
        await AsyncStorage.setItem(v2.language('guest'), legacy);
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function setPreferredLanguage(lang: AppLanguage, userId: number | null = null): Promise<void> {
  try {
    const scope = preferenceScopeFromUserId(userId);
    await AsyncStorage.setItem(v2.language(scope), lang);
    await syncAppliedLanguageForDevice(lang);
  } catch {
    // ignore
  }
}

async function getRawPushValue(scope: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(v2.pushEnabled(scope));
  } catch {
    return null;
  }
}

/** `true` / `false` when set; `null` when nothing stored for this scope (caller may treat as default). */
export async function getPushNotificationsStored(userId: number | null = null): Promise<boolean | null> {
  try {
    const scope = preferenceScopeFromUserId(userId);
    let v = await getRawPushValue(scope);
    if (v != null) return v === 'true';

    if (scope === 'guest') {
      const legacy = await AsyncStorage.getItem(LEGACY.pushEnabled);
      if (legacy != null) {
        await AsyncStorage.setItem(v2.pushEnabled('guest'), legacy);
        return legacy === 'true';
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function getPushNotificationsEnabled(userId: number | null = null): Promise<boolean> {
  const stored = await getPushNotificationsStored(userId);
  if (stored == null) return true;
  return stored;
}

export async function setPushNotificationsEnabled(enabled: boolean, userId: number | null = null): Promise<void> {
  try {
    const scope = preferenceScopeFromUserId(userId);
    await AsyncStorage.setItem(v2.pushEnabled(scope), enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

/**
 * When a user signs in and has no saved prefs yet, copy explicit guest prefs so the account matches what they saw while logged out.
 */
export async function seedFirstLoginPreferencesFromGuest(userId: number): Promise<void> {
  try {
    const userScope = preferenceScopeFromUserId(userId);

    const existingLang = await AsyncStorage.getItem(v2.language(userScope));
    if (existingLang !== 'id' && existingLang !== 'en') {
      const guestLang = await getLanguageForPublicOrGuestSession();
      if (guestLang) await setPreferredLanguage(guestLang, userId);
    }

    const existingPush = await getRawPushValue(userScope);
    if (existingPush == null) {
      const guestStored = await getPushNotificationsStored(null);
      if (guestStored != null) {
        await setPushNotificationsEnabled(guestStored, userId);
      }
    }
  } catch {
    // ignore
  }
}
