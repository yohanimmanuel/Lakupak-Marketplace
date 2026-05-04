import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

export type PlatformAnnouncement = {
  id: number;
  title: string;
  body: string;
  category: string;
  imageUrl: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
};

const READ_IDS_PREFIX = 'laku_latest_updates_read_';
const DISMISSED_IDS_PREFIX = 'laku_latest_updates_dismissed_';

function readKey(userId: number | null): string {
  return userId !== null ? `${READ_IDS_PREFIX}${userId}` : `${READ_IDS_PREFIX}anonymous`;
}

function dismissedKey(userId: number | null): string {
  return userId !== null ? `${DISMISSED_IDS_PREFIX}${userId}` : `${DISMISSED_IDS_PREFIX}anonymous`;
}

/**
 * Serialize read/modify/write AsyncStorage updates per user key to avoid lost updates.
 */
const readIdsWriteLocks = new Map<string, Promise<void>>();

async function withReadIdsWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = readIdsWriteLocks.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  // Ensure the queue continues even if a previous task failed.
  readIdsWriteLocks.set(key, prev.then(() => gate, () => gate));

  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (readIdsWriteLocks.get(key) === gate) {
      readIdsWriteLocks.delete(key);
    }
  }
}

export async function fetchPublishedLatestUpdateById(id: number): Promise<PlatformAnnouncement | null> {
  const url = `${API_BASE_URL}/api/marketplace/latest-updates/${id}`;
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to load update (${res.status})`);
  }
  const data = (await res.json()) as { announcement?: PlatformAnnouncement };
  return data.announcement ?? null;
}

export async function fetchPublishedLatestUpdates(options?: {
  category?: string | null;
  limit?: number;
}): Promise<PlatformAnnouncement[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 100));
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.category && options.category !== 'all') {
    params.set('category', options.category);
  }
  const url = `${API_BASE_URL}/api/marketplace/latest-updates?${params.toString()}`;
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to load latest updates (${res.status})`);
  }
  const data = (await res.json()) as { announcements?: PlatformAnnouncement[] };
  return Array.isArray(data.announcements) ? data.announcements : [];
}

export async function getReadAnnouncementIds(userId: number | null): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(readKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)));
  } catch {
    return new Set();
  }
}

export async function markAnnouncementRead(id: number, userId: number | null): Promise<void> {
  const key = readKey(userId);
  await withReadIdsWriteLock(key, async () => {
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const current = await getReadAnnouncementIds(userId);
        current.add(id);
        await AsyncStorage.setItem(key, JSON.stringify([...current]));
        return;
      } catch (err) {
        console.error('[latestUpdatesService] markAnnouncementRead failed', err);
        // retry by re-reading to reduce read-modify-write races
      }
    }
  });
}

export async function markAnnouncementsRead(ids: number[], userId: number | null): Promise<void> {
  if (ids.length === 0) return;
  const key = readKey(userId);
  await withReadIdsWriteLock(key, async () => {
    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const current = await getReadAnnouncementIds(userId);
        ids.forEach((id) => current.add(id));
        await AsyncStorage.setItem(key, JSON.stringify([...current]));
        return;
      } catch (err) {
        console.error('[latestUpdatesService] markAnnouncementsRead failed', err);
      }
    }
  });
}

/**
 * Per-device/per-account dismissed Latest updates (not synced server-side).
 * Lets buyers hide rows locally without affecting other users.
 */
const dismissedIdsWriteLocks = new Map<string, Promise<void>>();

async function withDismissedIdsWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = dismissedIdsWriteLocks.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  dismissedIdsWriteLocks.set(key, prev.then(() => gate, () => gate));
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (dismissedIdsWriteLocks.get(key) === gate) {
      dismissedIdsWriteLocks.delete(key);
    }
  }
}

export async function getDismissedAnnouncementIds(userId: number | null): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(dismissedKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)));
  } catch {
    return new Set();
  }
}

export async function dismissAnnouncementFromList(id: number, userId: number | null): Promise<void> {
  const key = dismissedKey(userId);
  await withDismissedIdsWriteLock(key, async () => {
    const maxAttempts = 4;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const current = await getDismissedAnnouncementIds(userId);
        current.add(id);
        await AsyncStorage.setItem(key, JSON.stringify([...current]));
        return;
      } catch (err) {
        lastErr = err;
        console.error('[latestUpdatesService] dismissAnnouncementFromList failed', err);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Failed to persist dismissed announcement');
  });
}
