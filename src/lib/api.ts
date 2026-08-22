// Phase 6: merchant session is stored in an HttpOnly cookie (shopmate_session).
// The browser sends it automatically via credentials: 'include' — never localStorage.

const LEGACY_TOKEN_KEY = 'shopmate_token';

/** Remove any legacy JWT left in browser-accessible storage from pre-Phase-6 sessions. */
export function clearLegacyTokenStorage() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore storage access errors
  }
}

export interface PublicMerchant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface PublicStore {
  id: string;
  name: string;
  businessPhone: string | null;
  website: string | null;
  streetAddress: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface ProfileStatus {
  profileComplete: boolean;
  missingFields: string[];
}

export interface AuthResponse extends ProfileStatus {
  merchant: PublicMerchant;
  store: PublicStore;
}

export interface OnboardingResponse extends ProfileStatus {
  merchant: PublicMerchant;
  store: PublicStore;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Notify App-level listeners that the merchant's profile is incomplete.
    // This lets dashboard API calls auto-redirect to onboarding without extra round-trips.
    if (res.status === 403 && (data as any)?.code === 'PROFILE_INCOMPLETE') {
      window.dispatchEvent(new CustomEvent('shopmate_profile_incomplete'));
    }
    const err = new Error(data.error || 'Request failed') as Error & { fieldErrors?: Record<string, string> };
    if ((data as any)?.fieldErrors) err.fieldErrors = (data as any).fieldErrors;
    throw err;
  }
  return data as T;
}

export function signup(input: { fullName: string; businessName: string; email: string; password: string }) {
  return request<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

/** Revoke the current session on the server (clears HttpOnly cookie). */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Best-effort revocation; caller clears local auth state regardless.
  }
  clearLegacyTokenStorage();
}

export function fetchMe() {
  return request<AuthResponse>('/api/me');
}

export function updateProfile(input: {
  name?: string;
  phone?: string;
  email?: string;
  currentPassword?: string;
  password?: string;
}) {
  return request<{ merchant: PublicMerchant } & ProfileStatus>('/api/me', { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateStoreProfile(input: {
  name?: string;
  businessPhone?: string;
  website?: string;
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}) {
  return request<{ store: PublicStore } & ProfileStatus>('/api/me/store', { method: 'PATCH', body: JSON.stringify(input) });
}

export function completeProfile(input: {
  name: string;
  phone: string;
  storeName: string;
  businessPhone: string;
  website?: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}) {
  return request<OnboardingResponse>('/api/me/complete-profile', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function exchangeGoogleCode(code: string) {
  return request<AuthResponse>('/api/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Upload a new profile picture. Never uses base64 — sends multipart FormData. */
export async function uploadAvatar(file: File): Promise<{ merchant: PublicMerchant }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await fetch('/api/me/avatar', {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Do NOT set Content-Type; browser sets it automatically with correct boundary
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to upload avatar');
  return data as { merchant: PublicMerchant };
}

/** Remove the current profile picture. */
export async function deleteAvatar(): Promise<{ merchant: PublicMerchant }> {
  const res = await fetch('/api/me/avatar', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to remove avatar');
  return data as { merchant: PublicMerchant };
}

export interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  status: 'Trained' | 'Pending';
  description?: string;
  imageUrl?: string;
  rawAttributes?: Record<string, any>;
}

export interface ProductsResponse {
  products: ApiProduct[];
  isWebsiteConnected?: boolean;
  connectedChannels?: string[];
}

export async function listProducts(): Promise<ProductsResponse> {
  const res = await request<ApiProduct[] | ProductsResponse>('/api/products');
  if (Array.isArray(res)) {
    return { products: res, isWebsiteConnected: false };
  }
  return res;
}

export function createProduct(input: { name: string; sku: string; price: number; inventory: number; status?: 'Trained' | 'Pending'; description?: string; rawAttributes?: Record<string, any> }) {
  return request<ApiProduct>('/api/products', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteProduct(id: string) {
  return request<void>(`/api/products/${id}`, { method: 'DELETE' });
}

/** Upload a product photo. Field name must be "image" to match the backend's multer config. */
export async function uploadProductImage(productId: string, file: File): Promise<ApiProduct> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`/api/products/${productId}/image`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Do NOT set Content-Type; browser sets it automatically with correct boundary
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to upload product image');
  return data as ApiProduct;
}

export async function deleteProductImage(productId: string): Promise<ApiProduct> {
  const res = await fetch(`/api/products/${productId}/image`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to remove product image');
  return data as ApiProduct;
}

export interface ApiPersona {
  tone: string;
  style: string;
  customInstructions: string;
  autoFinalizeOrdersAlways: boolean;
  openingText?: string;
  openingImageUrl?: string;
}

export function getPersona() {
  return request<ApiPersona>('/api/persona');
}

export function updatePersona(input: { tone: string; style: string; customInstructions: string; autoFinalizeOrdersAlways?: boolean; openingText?: string }) {
  return request<ApiPersona>('/api/persona', { method: 'PUT', body: JSON.stringify(input) });
}

/** Upload the opening-greeting photo. Field name must be "image" to match the backend's multer config. */
export async function uploadOpeningImage(file: File): Promise<{ openingImageUrl?: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('/api/persona/opening-image', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to upload greeting image');
  return data;
}

export async function deleteOpeningImage(): Promise<{ openingImageUrl?: string }> {
  const res = await fetch('/api/persona/opening-image', {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to remove greeting image');
  return data;
}

export interface ApiChatMessage {
  id: string;
  sender: 'customer' | 'ai' | 'merchant';
  text: string;
  imageUrl?: string;
  time: string;
  pending?: boolean;
}

export interface ApiConversation {
  id: string;
  customerName: string;
  avatarUrl?: string;
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'websocket';
  lastMessage: string;
  time: string;
  unread: boolean;
  status: 'Active' | 'AI Managed' | 'Closed';
  messages: ApiChatMessage[];
  isComplaint?: boolean;
  cart?: { sku: string; quantity: number }[];
  detectedAddress?: string;
  orderConfirmed?: boolean;
  orderConfirmationRequested?: boolean;
}

export function listConversations() {
  return request<ApiConversation[]>('/api/conversations');
}

export function updateConversationStatus(id: string, status: 'Active' | 'AI Managed' | 'Closed') {
  return request<ApiConversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function updateConversationCart(id: string, cart: { sku: string; quantity: number }[]) {
  return request<ApiConversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ cart }) });
}

export function updateConversationComplaint(id: string, isComplaint: boolean) {
  return request<ApiConversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ isComplaint }) });
}

export function deleteConversation(id: string) {
  return request<{ success: boolean }>(`/api/conversations/${id}`, { method: 'DELETE' });
}

export function sendConversationMessage(
  id: string,
  text: string,
  sender: 'customer' | 'merchant' = 'customer',
  discardDraftId?: string
) {
  return request<ApiConversation>(`/api/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text, sender, discardDraftId }),
  });
}

export function approveDraftMessage(conversationId: string, messageId: string) {
  return request<ApiConversation>(`/api/conversations/${conversationId}/messages/${messageId}/approve`, {
    method: 'POST',
  });
}

export interface ApiNotification {
  id: string;
  type: 'message' | 'inventory';
  title: string;
  body: string;
  time: string | null;
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'websocket' | 'system';
}

export function listNotifications() {
  return request<ApiNotification[]>('/api/notifications');
}

export interface ApiChannel {
  type: 'facebook' | 'instagram' | 'whatsapp' | 'websocket' | 'shopify' | 'woocommerce';
  connected: boolean;
  name: string | null;
}

export function listChannels() {
  return request<ApiChannel[]>('/api/channels');
}

export function disconnectChannel(type: string) {
  return request<{ success: boolean }>(`/api/channels/${type}`, { method: 'DELETE' });
}

export function connectWhatsAppChannel(input: { phoneNumberId: string; accessToken: string; phoneNumber?: string }) {
  return request<{ success: boolean }>('/api/channels/whatsapp/connect', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function connectShopifyChannel(input: { domain: string; accessToken: string }) {
  return request<{ success: boolean; name: string }>('/api/channels/shopify/connect', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function syncShopifyChannel() {
  return request<{ success: boolean; created: number; updated: number; total: number }>('/api/channels/shopify/sync', {
    method: 'POST',
  });
}

export function connectWooCommerceChannel(input: { url: string; consumerKey: string; consumerSecret: string }) {
  return request<{ success: boolean; name: string }>('/api/channels/woocommerce/connect', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function syncWooCommerceChannel() {
  return request<{ success: boolean; created: number; updated: number; total: number }>('/api/channels/woocommerce/sync', {
    method: 'POST',
  });
}

// Mint a one-time opaque connect code, then navigate to the OAuth start URL.
// Session JWTs are never placed in query strings.
export async function getShopifyConnectUrl(domain: string): Promise<string> {
  const { code } = await request<{ code: string }>('/api/channels/shopify/prepare', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
  return `/api/channels/shopify/connect?code=${encodeURIComponent(code)}`;
}

export async function getFacebookConnectUrl(): Promise<string> {
  const { code } = await request<{ code: string }>('/api/channels/facebook/prepare', {
    method: 'POST',
  });
  return `/api/channels/facebook/connect?code=${encodeURIComponent(code)}`;
}

// Full-page redirect to the Google OAuth consent screen (no auth token required —
// this is the merchant login/signup entry point, not a channel connection).
export function getGoogleConnectUrl(): string {
  return '/api/auth/google/connect';
}

export interface FacebookPendingPage {
  id: string;
  name: string;
}

export function getFacebookPendingPages(pendingCode: string) {
  return request<{ pages: FacebookPendingPage[] }>(`/api/channels/facebook/pending?code=${encodeURIComponent(pendingCode)}`);
}

export function selectFacebookPage(pendingCode: string, pageId: string) {
  return request<{ success: boolean }>('/api/channels/facebook/select', {
    method: 'POST',
    body: JSON.stringify({ pendingCode, pageId }),
  });
}

export interface WhatsAppPendingNumber {
  id: string;
  display_phone_number: string;
  name?: string;
}

export function getWhatsAppPendingNumbers(pendingCode: string) {
  return request<{ numbers: WhatsAppPendingNumber[] }>(`/api/channels/whatsapp/pending?code=${encodeURIComponent(pendingCode)}`);
}

export function selectWhatsAppNumber(pendingCode: string, phoneNumberId: string) {
  return request<{ success: boolean }>('/api/channels/whatsapp/select', {
    method: 'POST',
    body: JSON.stringify({ pendingCode, phoneNumberId }),
  });
}

export interface ApiOrderItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ApiOrder {
  id: string;
  conversationId: string | null;
  items: ApiOrderItem[];
  customerName: string;
  address: string;
  status: 'Processing' | 'On the Way' | 'Delivered' | 'Cancelled';
  total: number;
  createdAt: string;
}

export function listOrders() {
  return request<ApiOrder[]>('/api/orders');
}

export function updateOrderStatus(id: string, status: 'Processing' | 'On the Way' | 'Delivered' | 'Cancelled') {
  return request<ApiOrder>(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function createOrderFromConversation(conversationId: string, input: { customerName?: string; address: string }) {
  return request<ApiOrder>(`/api/conversations/${conversationId}/orders`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface ApiAnalyticsActivity {
  id: string;
  type: 'order' | 'complaint' | 'inventory';
  title: string;
  body: string;
  time: string | null;
}

export interface ApiAnalytics {
  range: 30 | 90;
  series: { date: string; conversations: number; convertedSales: number }[];
  kpis: {
    automationRate: number;
    averageResponseTime: null;
    orderCount: number;
    revenue: number;
    aiMessages: number;
    complaints: number;
  };
  recentActivity: ApiAnalyticsActivity[];
}

export function fetchAnalytics(range: 30 | 90 = 30) {
  return request<ApiAnalytics>(`/api/analytics?range=${range}`);
}
