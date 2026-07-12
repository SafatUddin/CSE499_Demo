export type Tab =
  | 'landing'
  | 'login'
  | 'signup'
  | 'inbox'
  | 'catalog'
  | 'analytics'
  | 'integrations'
  | 'settings'
  | 'support';

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  status: 'Trained' | 'Pending';
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'ai' | 'merchant';
  text: string;
  time: string;
  isImage?: boolean;
  imageUrl?: string;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  customerName: string;
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'websocket';
  lastMessage: string;
  time: string;
  unread: boolean;
  status: 'Active' | 'AI Managed' | 'Closed';
  messages: ChatMessage[];
  lastProductViewed?: string;
  isComplaint?: boolean;
  cart?: { sku: string; quantity: number }[];
  suggestedProducts?: string[];
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  statusText: string;
  hasAction: boolean;
  actionText?: string;
  logoType: 'facebook' | 'instagram' | 'whatsapp' | 'shopify' | 'woocommerce';
}

export interface AIPersona {
  tone: string;
  style: 'bullets' | 'narrative';
  customInstructions: string;
}

export interface DailyMetric {
  date: string;
  conversations: number;
  convertedSales: number;
}

export interface RecentActivity {
  id: string;
  type: 'checkout' | 'inquiry' | 'alert';
  orderId?: string;
  time: string;
  title: string;
  description: string;
  badge?: string;
  price?: number;
  productName?: string;
}
