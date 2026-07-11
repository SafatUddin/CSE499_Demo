const TOKEN_KEY = 'shopmate_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export interface PublicMerchant {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface PublicStore {
  id: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  merchant: PublicMerchant;
  store: PublicStore;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export function signup(input: { fullName: string; businessName: string; email: string; password: string }) {
  return request<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMe() {
  return request<{ merchant: PublicMerchant; store: PublicStore }>('/api/me');
}

export function updateProfile(input: {
  name?: string;
  email?: string;
  avatarUrl?: string;
  currentPassword?: string;
  password?: string;
}) {
  return request<{ merchant: PublicMerchant }>('/api/me', { method: 'PATCH', body: JSON.stringify(input) });
}

export interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  status: 'Trained' | 'Pending';
}

export function listProducts() {
  return request<ApiProduct[]>('/api/products');
}

export function createProduct(input: { name: string; sku: string; price: number; inventory: number; status?: 'Trained' | 'Pending' }) {
  return request<ApiProduct>('/api/products', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteProduct(id: string) {
  return request<void>(`/api/products/${id}`, { method: 'DELETE' });
}

export interface ApiPersona {
  tone: string;
  style: string;
  customInstructions: string;
}

export function getPersona() {
  return request<ApiPersona>('/api/persona');
}

export function updatePersona(input: { tone: string; style: string; customInstructions: string }) {
  return request<ApiPersona>('/api/persona', { method: 'PUT', body: JSON.stringify(input) });
}
