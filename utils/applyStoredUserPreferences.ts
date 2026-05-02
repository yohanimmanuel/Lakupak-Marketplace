import i18n from '../i18n';
import {
  getPreferredLanguage,
  getLanguageForPublicOrGuestSession,
  seedFirstLoginPreferencesFromGuest,
  syncAppliedLanguageForDevice,
} from './preferences';
import { pushNotificationService } from '../services/pushNotifications';
import { useAuthStore } from '../stores/authStore';

/**
 * Apply persisted language + push-notification preference scope for the active account (or guest).
 * Call after auth hydration and whenever `user.id` changes (login / logout / account switch).
 */
export async function applyStoredUserPreferences(userId: number | null): Promise<void> {
  if (userId != null) {
    await seedFirstLoginPreferencesFromGuest(userId);
  }

  pushNotificationService.setPreferenceUserScope(userId);
  await pushNotificationService.hydrateAllCategoryPreferences();

  const preferred =
    userId != null ? await getPreferredLanguage(userId) : await getLanguageForPublicOrGuestSession();
  const lng = preferred ?? 'id';
  await syncAppliedLanguageForDevice(lng);
  await i18n.changeLanguage(lng);

  if (userId != null) {
    const authToken = useAuthStore.getState().token;
    if (authToken) {
      try {
        await pushNotificationService.setMarketplaceUserPushLanguage(authToken, lng);
      } catch {
        // best-effort — _layout registration will retry
      }
    }
  }
}
