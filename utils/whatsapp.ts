import { Alert, Linking } from 'react-native';

function digitsOnly(input: string): string {
  return input.replace(/[^\d]/g, '');
}

/**
 * Best-effort normalization for WhatsApp "wa.me" numbers.
 * - Strips non-digits
 * - If it starts with "0" (common local format in ID), converts to "62" + rest
 * - If it starts with "8" (ID mobile numbers often written without leading 0), converts to "62" + digits
 * - Otherwise leaves as-is (already includes country code)
 */
export function normalizePhoneForWhatsApp(rawPhone: string): string | null {
  const raw = String(rawPhone ?? '').trim();
  if (!raw) return null;

  const d = digitsOnly(raw);
  if (!d) return null;

  if (d.startsWith('0') && d.length >= 9) return `62${d.slice(1)}`;
  if (d.startsWith('8') && d.length >= 8) return `62${d}`;
  return d;
}

export function buildWhatsAppUrl(params: { phone: string; text?: string }): string | null {
  const phone = normalizePhoneForWhatsApp(params.phone);
  if (!phone) return null;
  const base = `https://wa.me/${phone}`;
  const text = (params.text ?? '').trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export async function openWhatsApp(params: { phone: string; text?: string; onErrorMessage?: string }) {
  const url = buildWhatsAppUrl({ phone: params.phone, text: params.text });
  if (!url) {
    Alert.alert('WhatsApp', params.onErrorMessage ?? 'Phone number is not available.');
    return;
  }

  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert('WhatsApp', params.onErrorMessage ?? 'Unable to open WhatsApp on this device.');
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('WhatsApp', params.onErrorMessage ?? 'Unable to open WhatsApp.');
  }
}

