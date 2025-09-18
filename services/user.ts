import { API_BASE_URL } from './config'
import { trackAsync, logError } from './monitoring'

export type MobileUser = {
  id: number
  username?: string | null
  name?: string | null
  storeName?: string | null
  email?: string | null
  bio?: string | null
  phone?: string | null
  image?: string | null
  bannerImage?: string | null
  chosenAddress?: string | null
  country?: string | null
}

export async function getMe(token: string) {
  return trackAsync('getMe', async () => {
    const res = await fetch(`${API_BASE_URL}/api/mobile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      let msg = 'Failed to fetch user'
      try { const j = await res.json(); msg = j?.message || j?.error || msg } catch {}
      logError('Failed to fetch user profile', { status: res.status, message: msg })
      throw new Error(msg)
    }
    return res.json() as Promise<MobileUser>
  })
}

export async function updateMe(
  token: string,
  data: {
    username?: string
    name?: string
    storeName?: string
    email?: string
    bio?: string
    phone?: string
    image?: string
    bannerImage?: string
    chosenAddress?: string
    country?: string
  }
) {
  return trackAsync('updateMe', async () => {
    const res = await fetch(`${API_BASE_URL}/api/mobile/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      let msg = 'Failed to update user'
      try { const j = await res.json(); msg = j?.message || j?.error || msg } catch {}
      logError('Failed to update user profile', { status: res.status, message: msg, data })
      throw new Error(msg)
    }
    return res.json() as Promise<MobileUser>
  })
}


