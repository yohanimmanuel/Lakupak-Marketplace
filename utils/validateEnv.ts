type MobileAppId = 'marketplace';

const PRODUCTION_API_REQUIRED =
  'EXPO_PUBLIC_API_BASE_URL is required for production builds — set it in .env or eas.json (see env.example).';

/**
 * Logs environment warnings at startup. Never throws — mobile dev relies on Expo host inference.
 */
export function logMobileEnvWarnings(app: MobileAppId): void {
  const env = process.env.EXPO_PUBLIC_ENV || process.env.NODE_ENV || 'development';
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (env === 'production' && !apiUrl) {
    console.error(`[env][${app}] ${PRODUCTION_API_REQUIRED}`);
    return;
  }

  if (__DEV__ && !apiUrl) {
    console.warn(
      `[env][${app}] EXPO_PUBLIC_API_BASE_URL not set — using emulator defaults or Expo host inference. See env.example.`,
    );
  }
}
