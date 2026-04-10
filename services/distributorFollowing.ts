import { API_BASE_URL } from './config';

export type FollowedDistributor = {
  distributorId: number;
  name: string;
  logo: string | null;
  bannerImage: string | null;
  followedAt: string;
};

const base = (API_BASE_URL || '').replace(/\/$/, '');

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function isFollowingDistributor(token: string, distributorId: number): Promise<boolean> {
  const r = await fetch(`${base}/api/mobile/following/distributors/${distributorId}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  if (!r.ok) {
    throw new Error('Failed to check following state');
  }
  const data = (await r.json()) as { isFollowing?: boolean };
  return !!data.isFollowing;
}

export async function followDistributor(token: string, distributorId: number): Promise<void> {
  const r = await fetch(`${base}/api/mobile/following/distributors`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ distributorId }),
  });
  if (!r.ok) {
    throw new Error('Failed to follow distributor');
  }
}

export async function unfollowDistributor(token: string, distributorId: number): Promise<void> {
  const r = await fetch(`${base}/api/mobile/following/distributors/${distributorId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!r.ok) {
    throw new Error('Failed to unfollow distributor');
  }
}

export async function listFollowedDistributors(token: string): Promise<FollowedDistributor[]> {
  const r = await fetch(`${base}/api/mobile/following/distributors`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  if (!r.ok) {
    throw new Error('Failed to load followings');
  }
  const data = (await r.json()) as { items?: FollowedDistributor[] };
  return Array.isArray(data.items) ? data.items : [];
}

