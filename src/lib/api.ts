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
  autoFinalizeOrdersAlways: boolean;
}

export function getPersona() {
  return request<ApiPersona>('/api/persona');
}

export function updatePersona(input: { tone: string; style: string; customInstructions: string; autoFinalizeOrdersAlways?: boolean }) {
  return request<ApiPersona>('/api/persona', { method: 'PUT', body: JSON.stringify(input) });
}

export interface ApiChatMessage {
  id: string;
  sender: 'customer' | 'ai' | 'merchant';
  text: string;
  time: string;
  pending?: boolean;
}

export interface ApiConversation {
  id: string;
  customerName: string;
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
  type: 'facebook' | 'instagram' | 'whatsapp' | 'websocket';
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

// Full-page redirect (not a fetch) since it hands off to Facebook's OAuth dialog.
// The token travels as a query param because a browser navigation can't carry an
// Authorization header.
export function getFacebookConnectUrl(): string {
  const token = getToken() || '';
  return `/api/channels/facebook/connect?token=${encodeURIComponent(token)}`;
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

export function getFacebookPendingPages(pendingToken: string) {
  return request<{ pages: FacebookPendingPage[] }>(`/api/channels/facebook/pending?token=${encodeURIComponent(pendingToken)}`);
}

export function selectFacebookPage(pendingToken: string, pageId: string) {
  return request<{ success: boolean }>('/api/channels/facebook/select', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, pageId }),
  });
}

export interface WhatsAppPendingNumber {
  id: string;
  display_phone_number: string;
  name?: string;
}

export function getWhatsAppPendingNumbers(pendingToken: string) {
  return request<{ numbers: WhatsAppPendingNumber[] }>(`/api/channels/whatsapp/pending?token=${encodeURIComponent(pendingToken)}`);
}

export function selectWhatsAppNumber(pendingToken: string, phoneNumberId: string) {
  return request<{ success: boolean }>('/api/channels/whatsapp/select', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, phoneNumberId }),
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
  status: 'Pending' | 'Fulfilled' | 'Cancelled';
  total: number;
  createdAt: string;
}

export function listOrders() {
  return request<ApiOrder[]>('/api/orders');
}

export function updateOrderStatus(id: string, status: 'Pending' | 'Fulfilled' | 'Cancelled') {
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
