import { API_BASE_URL } from './config'

export type Channel = 'whatsapp' | 'sms'

export async function signInWithGoogle(): Promise<{ token: string; user: { id: number; name?: string | null; email: string; address?: string | null } }> {
  // Temporarily disabled for debugging
  throw new Error('Google Sign-in is temporarily disabled. Please use WhatsApp/SMS login.')
}

export async function signOutGoogle() {
  // No-op for now
  return Promise.resolve()
}

export async function requestOtp(phone: string, countryCode?: string, channel: Channel = 'sms') {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, countryCode, channel }),
  })
  if (!res.ok) throw new Error('Failed to request OTP')
  return res.json() as Promise<{ ok: boolean; devCode?: string }>
}

export async function verifyOtp(params: { 
  phone: string; 
  countryCode?: string; 
  code: string; 
  profile?: { 
    name?: string; 
    email?: string; 
    storeName?: string;
    bio?: string;
    username?: string;
    password?: string;
  };
  mode?: 'signup' | 'login';
}) {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  
  if (!res.ok) {
    let errorMessage = 'Failed to verify OTP'
    try {
      const errorData = await res.json()
      errorMessage = errorData.error || errorMessage
    } catch (parseError) {
      // Use default error message
    }
    throw new Error(errorMessage)
  }
  
  return res.json() as Promise<{ token: string; user: { id: number; name?: string | null; email: string; address?: string | null } }>
}

// Username/Password Authentication
export async function loginWithCredentials(username: string, password: string): Promise<{ token: string; user: { id: number; name?: string | null; email: string; address?: string | null } }> {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  
  if (!res.ok) {
    let errorMessage = 'Login failed. Please try again.'
    try {
      const errorData = await res.json()
      errorMessage = errorData.message || errorMessage
    } catch (parseError) {
      if (res.status === 401) {
        errorMessage = 'Invalid username or password.'
      } else if (res.status === 404) {
        errorMessage = 'User not found. Please sign up first.'
      }
    }
    throw new Error(errorMessage)
  }
  
  return res.json()
}

// Multi-step Signup - Local validation only (backend handles final creation)
export async function signupStep1(name: string, email: string): Promise<{ success: boolean; message?: string }> {
  if (!name.trim() || !email.trim()) {
    throw new Error('Please enter both name and email.')
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('Please enter a valid email address.')
  }
  
  return { success: true, message: 'Step 1 completed' }
}

export async function signupStep2(storeName: string, bio: string): Promise<{ success: boolean; message?: string }> {
  if (!storeName.trim()) {
    throw new Error('Please enter a store name.')
  }
  
  return { success: true, message: 'Step 2 completed' }
}

export async function signupStep3(username: string, password: string): Promise<{ success: boolean; message?: string }> {
  if (!username.trim() || !password.trim()) {
    throw new Error('Please enter both username and password.')
  }
  
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }
  
  return { success: true, message: 'Step 3 completed' }
}

// Forgot password: request reset (sends generic success; in production would send email)
export async function requestForgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send reset instructions.')
  }
  return { message: data.message || 'If this email is registered, check your inbox for instructions.' }
}

// Reset password: set new password (requires verification code from email)
export async function resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
  const trimmed = email.trim().toLowerCase()
  const code = typeof token === 'string' ? token.trim() : ''
  if (!code) {
    throw new Error('Verification code is required. Check your email for the code we sent.')
  }
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }

  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmed, token: code, password: newPassword }),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; code?: string }
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to reset password.')
    ;(err as Error & { code?: string }).code = data.code
    throw err
  }
  return { message: data.message || 'Password has been reset. You can now log in.' }
}


