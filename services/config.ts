import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API Configuration
 * Production-ready config that handles dev, staging, and production environments
 * Similar to how Shopify Mobile, Amazon, and other e-commerce apps manage API endpoints
 */

type Environment = 'development' | 'staging' | 'production';

interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

/**
 * Get the current environment
 */
function getEnvironment(): Environment {
  const env = process.env.EXPO_PUBLIC_ENV || process.env.NODE_ENV || 'development';
  return env as Environment;
}

/**
 * Get the appropriate API base URL for the current environment
 * In development:
 * - Android emulator: Use 10.0.2.2 (emulator's special alias for host machine)
 * - iOS simulator: Use localhost
 * - Physical device: Use EXPO_PUBLIC_API_BASE_URL from .env (your computer's IP)
 */
function getApiBaseUrl(): string {
  const environment = getEnvironment();

  if (environment === 'production') {
    return process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.laku.com';
  }
  if (environment === 'staging') {
    return process.env.EXPO_PUBLIC_API_BASE_URL || 'https://staging-api.laku.com';
  }
  const customUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (customUrl) return customUrl;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  if (Platform.OS === 'ios') return 'http://localhost:3000';
  return 'http://localhost:3000';
}

/**
 * API Configuration
 */
const apiConfig: ApiConfig = {
  baseUrl: getApiBaseUrl(),
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
};

/**
 * Check if running in development mode
 */
export const isDevelopment = getEnvironment() === 'development';

/**
 * Check if running in production mode
 */
export const isProduction = getEnvironment() === 'production';

/**
 * Exported API base URL (backward compatible)
 */
export const API_BASE_URL = apiConfig.baseUrl;

/**
 * Full API configuration
 */
export const API_CONFIG = apiConfig;

/**
 * App version
 */
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';



