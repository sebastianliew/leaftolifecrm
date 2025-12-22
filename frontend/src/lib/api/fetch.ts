/**
 * Authenticated fetch wrapper that automatically includes credentials
 * This ensures all API calls include authentication cookies
 */

interface FetchOptions extends RequestInit {
  // Ensure credentials is always included
  credentials?: RequestCredentials;
}

/**
 * Wrapper around fetch that automatically includes credentials
 * Use this for all authenticated API calls
 */
export async function authFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // Always include credentials
    headers: {
      ...options.headers,
    },
  });
}

/**
 * Authenticated fetch with JSON parsing
 */
export async function authFetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await authFetch(url, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Helper methods for common HTTP verbs
 */
export const api = {
  get: <T = unknown>(url: string, options?: FetchOptions) => 
    authFetchJSON<T>(url, { ...options, method: 'GET' }),
  
  post: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) => 
    authFetchJSON<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  put: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) => 
    authFetchJSON<T>(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  delete: <T = unknown>(url: string, options?: FetchOptions) => 
    authFetchJSON<T>(url, { ...options, method: 'DELETE' }),
  
  patch: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) => 
    authFetchJSON<T>(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
};

// Raw fetch for non-JSON responses
export const apiRaw = {
  get: (url: string, options?: FetchOptions) => 
    authFetch(url, { ...options, method: 'GET' }),
  
  post: (url: string, body?: unknown, options?: FetchOptions) => 
    authFetch(url, {
      ...options,
      method: 'POST',
      headers: body instanceof FormData ? options?.headers : {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    }),
  
  put: (url: string, body?: unknown, options?: FetchOptions) => 
    authFetch(url, {
      ...options,
      method: 'PUT',
      headers: body instanceof FormData ? options?.headers : {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    }),
  
  delete: (url: string, options?: FetchOptions) => 
    authFetch(url, { ...options, method: 'DELETE' }),
};