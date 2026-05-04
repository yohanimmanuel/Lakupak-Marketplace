import { API_BASE_URL } from './config'

export type Channel = 'whatsapp' | 'sms'

/** Thrown by login/forgot/signup/OTP — UI maps to i18n via `code`, not raw API English. */
export const AUTH_ERROR_CODE = {
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  LOGIN_FAILED: 'LOGIN_FAILED',
  OTP_VERIFY_FAILED: 'OTP_VERIFY_FAILED',
  OTP_REQUEST_FAILED: 'OTP_REQUEST_FAILED',
  SIGNUP_MISSING_NAME_EMAIL: 'SIGNUP_MISSING_NAME_EMAIL',
  SIGNUP_INVALID_EMAIL: 'SIGNUP_INVALID_EMAIL',
  SIGNUP_MISSING_STORE: 'SIGNUP_MISSING_STORE',
  SIGNUP_MISSING_CREDENTIALS: 'SIGNUP_MISSING_CREDENTIALS',
  SIGNUP_WEAK_PASSWORD: 'SIGNUP_WEAK_PASSWORD',
  FORGOT_PASSWORD_FAILED: 'FORGOT_PASSWORD_FAILED',
  VERIFICATION_CODE_REQUIRED: 'VERIFICATION_CODE_REQUIRED',
} as const

export type AuthThrownError = Error & { code?: string }

export function getAuthErrorCode(error: unknown): string | undefined {
  if (error instanceof Error && typeof (error as AuthThrownError).code === 'string') {
    return (error as AuthThrownError).code
  }
  return undefined
}

function throwAuth(code: (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE]): never {
  const err = new Error('') as AuthThrownError
  err.code = code
  throw err
}

export async function signInWithGoogle(): Promise<{ token: string; user: { id: number; name?: string | null; email: string; address?: string | null } }> {
  throwAuth(AUTH_ERROR_CODE.LOGIN_FAILED)
}

export async function signOutGoogle() {
  return Promise.resolve()
}

export async function requestOtp(phone: string, countryCode?: string, channel: Channel = 'sms') {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, countryCode, channel }),
  })
  if (!res.ok) {
    if (res.status === 429) throwAuth(AUTH_ERROR_CODE.RATE_LIMITED)
    throwAuth(AUTH_ERROR_CODE.OTP_REQUEST_FAILED)
  }
  return res.json() as Promise<{ ok: boolean; devCode?: string }>
}

export async function verifyOtp(params: {
  phone: string
  countryCode?: string
  code: string
  profile?: {
    name?: string
    email?: string
    storeName?: string
    bio?: string
    username?: string
    password?: string
  }
  mode?: 'signup' | 'login'
}) {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    if (res.status === 429) throwAuth(AUTH_ERROR_CODE.RATE_LIMITED)
    throwAuth(AUTH_ERROR_CODE.OTP_VERIFY_FAILED)
  }

  return res.json() as Promise<{ token: string; user: { id: number; name?: string | null; email: string; address?: string | null } }>
}

export async function loginWithCredentials(username: string, password: string): Promise<{ token: string; user: { id: number; name?: string | null; email: string; address?: string | null } }> {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (res.ok) {
    return res.json()
  }

  let errorData: { error?: string; message?: string } = {}
  try {
    errorData = await res.json()
  } catch {
    // ignore parse errors
  }

  const msg = String(errorData?.message ?? '')
  if (res.status === 403 && (errorData?.error === 'ACCOUNT_SUSPENDED' || msg.toLowerCase().includes('suspend'))) {
    const err = new Error('') as AuthThrownError
    err.code = AUTH_ERROR_CODE.ACCOUNT_SUSPENDED
    throw err
  }

  if (res.status === 401) {
    const err = new Error('') as AuthThrownError
    err.code = AUTH_ERROR_CODE.INVALID_CREDENTIALS
    throw err
  }

  if (res.status === 404) {
    const err = new Error('') as AuthThrownError
    err.code = AUTH_ERROR_CODE.USER_NOT_FOUND
    throw err
  }

  if (res.status === 429) {
    const err = new Error('') as AuthThrownError
    err.code = AUTH_ERROR_CODE.RATE_LIMITED
    throw err
  }

  throwAuth(AUTH_ERROR_CODE.LOGIN_FAILED)
}

export async function signupStep1(name: string, email: string): Promise<{ success: boolean; message?: string }> {
  if (!name.trim() || !email.trim()) {
    throwAuth(AUTH_ERROR_CODE.SIGNUP_MISSING_NAME_EMAIL)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throwAuth(AUTH_ERROR_CODE.SIGNUP_INVALID_EMAIL)
  }

  return { success: true, message: 'Step 1 completed' }
}

export async function signupStep2(storeName: string, bio: string): Promise<{ success: boolean; message?: string }> {
  if (!storeName.trim()) {
    throwAuth(AUTH_ERROR_CODE.SIGNUP_MISSING_STORE)
  }

  return { success: true, message: 'Step 2 completed' }
}

export async function signupStep3(username: string, password: string): Promise<{ success: boolean; message?: string }> {
  if (!username.trim() || !password.trim()) {
    throwAuth(AUTH_ERROR_CODE.SIGNUP_MISSING_CREDENTIALS)
  }

  if (password.length < 6) {
    throwAuth(AUTH_ERROR_CODE.SIGNUP_WEAK_PASSWORD)
  }

  return { success: true, message: 'Step 3 completed' }
}

export async function requestForgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
  if (!res.ok) {
    const err = new Error('') as AuthThrownError
    if (res.status === 429) {
      err.code = AUTH_ERROR_CODE.RATE_LIMITED
    } else {
      err.code = AUTH_ERROR_CODE.FORGOT_PASSWORD_FAILED
    }
    throw err
  }
  return { message: data.message || 'If this email is registered, check your inbox for instructions.' }
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
  const trimmed = email.trim().toLowerCase()
  const code = typeof token === 'string' ? token.trim() : ''
  if (!code) {
    throwAuth(AUTH_ERROR_CODE.VERIFICATION_CODE_REQUIRED)
  }
  if (newPassword.length < 6) {
    throwAuth(AUTH_ERROR_CODE.SIGNUP_WEAK_PASSWORD)
  }

  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmed, token: code, password: newPassword }),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; code?: string }
  if (!res.ok) {
    const err = new Error('') as AuthThrownError
    if (res.status === 429) {
      err.code = AUTH_ERROR_CODE.RATE_LIMITED
    } else {
      err.code = data.code || AUTH_ERROR_CODE.OTP_VERIFY_FAILED
    }
    throw err
  }
  return { message: data.message || 'Password has been reset. You can now log in.' }
}
