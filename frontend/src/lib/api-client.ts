/**
 * API Client for communication with backend server
 * Handles authentication, token management, and API calls
 */

import Cookies from 'js-cookie';
import { permissionErrorHandler } from './permission-error-handler';
import { toast } from '@/components/ui/use-toast';

interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
  total?: number;
}

interface LoginResponse {
  accessToken?: string;
  token?: string;
  user: {
    _id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    [key: string]: unknown;
  };
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    // For user-related APIs, we need to call the main Next.js app
    // For other APIs, we call the backend Express server
    this.baseURL = config.baseURL || process.env.NEXT_PUBLIC_API_URL || '/api';
    this.timeout = config.timeout || 30000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers
    };
  }

  /**
   * Get stored token from cookies and localStorage
   */
  private getToken(): string | undefined {
    // Try cookies first (for SSR compatibility)
    const cookieToken = Cookies.get('authToken');
    if (cookieToken) return cookieToken;
    
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || undefined;
    }
    
    return undefined;
  }

  /**
   * Store token in both cookies and localStorage
   */
  private setToken(token: string): void {
    // Set in both cookie and localStorage for compatibility
    Cookies.set('authToken', token, { 
      expires: 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  /**
   * Clear stored tokens
   */
  private clearTokens(): void {
    Cookies.remove('authToken');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: this.defaultHeaders,
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const { accessToken } = data;
        
        if (accessToken) {
          this.setToken(accessToken);
          return accessToken;
        }
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }

    return null;
  }

  /**
   * Make API request with automatic token refresh on 401
   */
  private async request<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
    };

    // Handle different header types from options
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else {
        // It's already a Record<string, string>
        Object.assign(headers, options.headers);
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Also check for next-auth session cookie
    if (typeof window !== 'undefined') {
      const sessionToken = Cookies.get('next-auth.session-token') || Cookies.get('__Secure-next-auth.session-token');
      if (sessionToken && !token) {
        // If we have a NextAuth session but no JWT token, the API might still work with cookies
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers,
        signal: controller.signal,
        credentials: 'include'
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && token) {
        const newAccessToken = await this.refreshAccessToken();
        
        if (newAccessToken) {
          // Retry request with new token
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          
          const retryResponse = await fetch(`${this.baseURL}${url}`, {
            ...options,
            headers,
            credentials: 'include'
          });

          const retryData = await retryResponse.json().catch(() => null);
          
          return {
            data: retryData,
            status: retryResponse.status,
            ok: retryResponse.ok,
            error: retryResponse.ok ? undefined : retryData?.error || 'Request failed'
          };
        } else {
          // Refresh failed, clear tokens and redirect to login
          this.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname)}`;
          }
        }
      }

      const data = await response.json().catch(() => null);

      // Handle 403 Forbidden - permission denied
      if (response.status === 403) {
        const method = options.method || 'GET';
        permissionErrorHandler.handlePermissionDenied(
          url,
          method,
          data?.error || 'Permission denied'
        );
      }

      // Handle 429 Too Many Requests - rate limit exceeded
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        const retryMinutes = Math.ceil(retrySeconds / 60);

        toast({
          title: 'Too Many Requests',
          description: retryMinutes > 1
            ? `Please wait ${retryMinutes} minutes before trying again.`
            : 'Please wait a minute before trying again.',
          variant: 'destructive',
        });
      }

      return {
        data,
        status: response.status,
        ok: response.ok,
        error: response.ok ? undefined : data?.error || 'Request failed'
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 408,
          ok: false,
          error: 'Request timeout'
        };
      }
      
      return {
        status: 0,
        ok: false,
        error: (error instanceof Error ? error.message : String(error)) || 'Network error'
      };
    }
  }

  // HTTP Methods
  async get<T = unknown>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request<T>(`${url}${queryString}`, { method: 'GET' });
  }

  async post<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T = unknown>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'DELETE' });
  }

  // Auth specific methods
  async login(email: string, password: string): Promise<ApiResponse> {
    const response = await this.post<LoginResponse>('/auth/login', { email, password });
    
    if (response.ok && response.data) {
      const { accessToken, token, user } = response.data;
      const authToken = accessToken || token;
      if (authToken) {
        this.setToken(authToken);
      }
      return { ...response, data: { user } };
    }
    
    return response;
  }

  async logout(): Promise<void> {
    await this.post('/auth/logout');
    this.clearTokens();
    
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token;
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;
export { apiClient };

// Export convenience methods
export const api = {
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  login: apiClient.login.bind(apiClient),
  logout: apiClient.logout.bind(apiClient),
  isAuthenticated: apiClient.isAuthenticated.bind(apiClient)
};