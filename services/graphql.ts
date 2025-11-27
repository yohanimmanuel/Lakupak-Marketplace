import { API_BASE_URL } from './config';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
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

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const errorMessage = result.errors.map(e => e.message).join(', ');
    throw new Error(`GraphQL error: ${errorMessage}`);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return result.data;
}

