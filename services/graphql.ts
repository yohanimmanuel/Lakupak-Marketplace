import { API_BASE_URL } from './config';

import type { useAuthStore as UseAuthStoreType } from '../stores/authStore';

function getAuthStore(): typeof UseAuthStoreType {
  // Lazy load to avoid authStore -> user -> graphql -> authStore require cycle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../stores/authStore').useAuthStore;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; path?: string[]; extensions?: { code?: string; reason?: string | null } }[];
}

interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

/**
 * Decode JWT token to extract userId (without verification)
 * This is safe because we're just reading the payload, and the server will verify the token
 */
export function decodeToken(token: string): { userId?: number } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {};
    }
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const userId = typeof decoded.sub === 'string' ? parseInt(decoded.sub, 10) : decoded.sub;
    
    return { userId: typeof userId === 'number' && !isNaN(userId) ? userId : undefined };
  } catch {
    return {};
  }
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const shouldHandleSuspensionForToken = () => {
    // If logout already cleared/rotated the token, ignore late responses from in-flight requests.
    const currentToken = getAuthStore().getState().token;
    if (!token) return false;
    return currentToken === token;
  };

  // Auth-expiry signals the server sends when a mid-session token is no longer valid.
  // Note: the GraphQL layer reports this via extensions.code 'UNAUTHENTICATED' with the
  // message "Authentication required" — FORBIDDEN is an authorization error and must NOT
  // end the session.
  const isAuthExpiryMessage = (message: string) =>
    /UNAUTHENTICATED|Authentication required|Unable to extract userId from token|User not found|jwt expired|invalid token|Invalid or expired token/i.test(
      message,
    );
  const hasUnauthenticatedError = (errs?: GraphQLResponse<T>['errors']) =>
    !!errs?.some((e) => e.extensions?.code === 'UNAUTHENTICATED');

  // End the session when the token has died mid-session so the app doesn't get stuck
  // "logged in but every request 401s". Guarded by the same in-flight token check as
  // suspension, so a late failure can't log out a freshly re-authenticated session.
  const expireSessionForToken = () => {
    const store = getAuthStore().getState();
    if (!token || store.token !== token) return;
    void store.logout();
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables,
    } as GraphQLRequest),
  });

  // Some auth failures can come back as non-200 (middleware / context errors).
  // Always try to read the body so we can detect ACCOUNT_SUSPENDED reliably.
  let result: GraphQLResponse<T> | null = null;
  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    try {
      result = JSON.parse(txt) as GraphQLResponse<T>;
    } catch {
      // If the body isn't JSON but indicates suspension, still trigger the UI flow.
      if (txt.includes('ACCOUNT_SUSPENDED')) {
        if (shouldHandleSuspensionForToken()) {
          getAuthStore().getState().setSuspension(true, null);
        }
        const err = new Error('ACCOUNT_SUSPENDED') as Error & { code?: string; reason?: string | null };
        err.code = 'ACCOUNT_SUSPENDED';
        err.reason = null;
        throw err;
      }
      if (response.status === 401) {
        expireSessionForToken();
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } else {
    result = (await response.json()) as GraphQLResponse<T>;
  }

  // Handle suspension even when server returns non-200 but provides GraphQL-shaped JSON.
  if (result?.errors && result.errors.length > 0) {
    const suspensionErr =
      result.errors.find((e) => e.extensions?.code === 'ACCOUNT_SUSPENDED') ??
      result.errors.find((e) => e.message.includes('ACCOUNT_SUSPENDED'));
    if (suspensionErr) {
      const reason = suspensionErr.extensions?.reason ?? null;
      if (shouldHandleSuspensionForToken()) {
        getAuthStore().getState().setSuspension(true, reason);
      }
      const err = new Error('ACCOUNT_SUSPENDED') as Error & { code?: string; reason?: string | null };
      err.code = 'ACCOUNT_SUSPENDED';
      err.reason = reason;
      throw err;
    }
  }

  if (result.errors && result.errors.length > 0) {
    const errorMessage = result.errors.map(e => e.message).join(', ');
    if (errorMessage.includes('ACCOUNT_SUSPENDED')) {
      const reason =
        result.errors.find((e) => e.message.includes('ACCOUNT_SUSPENDED'))?.extensions?.reason ??
        result.errors.find((e) => e.extensions?.code === 'ACCOUNT_SUSPENDED')?.extensions?.reason ??
        null;
      // Trigger UI flow: 60s notice then redirect (handled globally)
      if (shouldHandleSuspensionForToken()) {
        getAuthStore().getState().setSuspension(true, reason);
      }
      const err = new Error('ACCOUNT_SUSPENDED') as Error & { code?: string; reason?: string | null }
      err.code = 'ACCOUNT_SUSPENDED'
      err.reason = reason
      throw err
    }
    if (response.status === 401 || hasUnauthenticatedError(result.errors) || isAuthExpiryMessage(errorMessage)) {
      expireSessionForToken();
    }
    throw new Error(`GraphQL error: ${errorMessage}`);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return result.data;
}

