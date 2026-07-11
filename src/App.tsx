import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Tab, Product, Integration, AIPersona, Conversation, ChatMessage } from './types';
import {
  INITIAL_INTEGRATIONS,
  DEFAULT_AI_PERSONA,
} from './data/mockData';
import {
  getToken,
  setToken,
  clearToken,
  fetchMe,
  updateProfile,
  listProducts,
  createProduct,
  deleteProduct,
  getPersona,
  updatePersona,
  listConversations,
  updateConversationStatus,
  AuthResponse,
  PublicMerchant,
  PublicStore,
} from './lib/api';

// Component Imports
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Sidebar from './components/Sidebar';
import InboxConsole from './components/InboxConsole';
import ProductCatalog from './components/ProductCatalog';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import IntegrationsHub from './components/IntegrationsHub';
import SettingsPage from './components/SettingsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Real auth state — merchant is null when logged out
  const [merchant, setMerchant] = useState<PublicMerchant | null>(null);
  const [store, setStore] = useState<PublicStore | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isAuthenticated = !!merchant;

  // DashboardHeader reads this shape straight out of localStorage; keep it in sync
  // with whatever the backend says is the current merchant.
  const syncProfileToLocalStorage = (m: PublicMerchant) => {
    const profile = {
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    };
    localStorage.setItem('shopmate_user_profile', JSON.stringify(profile));
    window.dispatchEvent(new Event('shopmate_profile_updated'));
  };

  // On load, if a token exists, verify it against the backend instead of trusting it blindly
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsCheckingAuth(false);
      return;
    }
    fetchMe()
      .then((res) => {
        setMerchant(res.merchant);
        setStore(res.store);
        syncProfileToLocalStorage(res.merchant);
        setActiveTab('inbox');
      })
      .catch(() => clearToken())
      .finally(() => setIsCheckingAuth(false));
  }, []);

  // Listen to custom header actions for seamless routing & logging out
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const tab = (e as CustomEvent).detail as Tab;
      setActiveTab(tab);
      setIsSidebarOpen(false);
    };
    const handleLogoutEvent = () => {
      handleLogout();
    };
    const handleToggleSidebarEvent = () => {
      setIsSidebarOpen(prev => !prev);
    };
    window.addEventListener('shopmate_navigate', handleNavigateEvent);
    window.addEventListener('shopmate_logout', handleLogoutEvent);
    window.addEventListener('shopmate_toggle_sidebar', handleToggleSidebarEvent);
    return () => {
      window.removeEventListener('shopmate_navigate', handleNavigateEvent);
      window.removeEventListener('shopmate_logout', handleLogoutEvent);
      window.removeEventListener('shopmate_toggle_sidebar', handleToggleSidebarEvent);
    };
  }, []);

  const handleAuthSuccess = (auth: AuthResponse) => {
    setToken(auth.token);
    setMerchant(auth.merchant);
    setStore(auth.store);
    syncProfileToLocalStorage(auth.merchant);
    setActiveTab('inbox');
    setIsSidebarOpen(false);
  };

  const handleUpdateProfile = async (updates: Partial<PublicMerchant> & { currentPassword?: string; password?: string }) => {
    const { merchant: updated } = await updateProfile(updates);
    setMerchant(updated);
    syncProfileToLocalStorage(updated);
  };

  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [persona, setPersona] = useState<AIPersona>(DEFAULT_AI_PERSONA);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Load real catalog + persona + conversations from the backend once we know who's logged in
  useEffect(() => {
    if (!merchant) return;
    listProducts().then(setProducts).catch((err) => console.error('Failed to load products:', err));
    getPersona()
      .then((p) => setPersona({ tone: p.tone, style: p.style as AIPersona['style'], customInstructions: p.customInstructions }))
      .catch((err) => console.error('Failed to load persona:', err));
    listConversations().then(setConversations).catch((err) => console.error('Failed to load conversations:', err));
  }, [merchant]);

  // Navigation controller
  const handleNavigate = (tab: Tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    clearToken();
    setMerchant(null);
    setStore(null);
    setActiveTab('landing');
    setIsSidebarOpen(false);
  };

  // Product mutations
  const handleAddProduct = async (newProduct: Omit<Product, 'id'>) => {
    const created = await createProduct(newProduct);
    setProducts((prev) => [created, ...prev]);
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    setProducts((prev) => prev.filter(p => p.id !== id));
  };

  // Integration mutations
  const handleToggleIntegration = (id: string) => {
    setIntegrations((prev) => prev.map((item) => {
      if (item.id === id) {
        const nextConnected = !item.connected;
        return {
          ...item,
          connected: nextConnected,
          statusText: nextConnected ? 'Active Sync' : 'Sync Paused'
        };
      }
      return item;
    }));
  };

  const handleRefreshAllIntegrations = async () => {
    // Simulating deep inventory pull
    setIntegrations((prev) => prev.map((item) => {
      if (item.connected) {
        return {
          ...item,
          statusText: 'Synchronized ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      return item;
    }));
  };

  // Persona save
  const handleSavePersona = async (newPersona: AIPersona) => {
    const saved = await updatePersona(newPersona);
    setPersona({ tone: saved.tone, style: saved.style as AIPersona['style'], customInstructions: saved.customInstructions });
  };

  // Conversations updating
  const handleUpdateConversation = (chatId: string, updates: Partial<Conversation>) => {
    setConversations((prev) => prev.map((chat) => {
      if (chat.id === chatId) {
        const updated = {
          ...chat,
          ...updates,
        };
        if (updates.messages) {
          updated.lastMessage = updates.messages[updates.messages.length - 1]?.text || chat.lastMessage;
          updated.unread = false;
        }
        return updated;
      }
      return chat;
    }));
  };

  const handleUpdateConversationStatus = async (chatId: string, status: 'Active' | 'AI Managed' | 'Closed') => {
    const updated = await updateConversationStatus(chatId, status);
    setConversations((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, ...updated } : chat)));
  };

  // Main page rendering logic based on active tab and authentication
  const renderPageContent = () => {
    if (!isAuthenticated) {
      switch (activeTab) {
        case 'landing':
          return <LandingPage onNavigate={handleNavigate} />;
        case 'login':
          return (
            <LoginPage
              onNavigate={handleNavigate}
              onLoginSuccess={handleAuthSuccess}
            />
          );
        case 'signup':
          return <SignupPage onNavigate={handleNavigate} onSignupSuccess={handleAuthSuccess} />;
        default:
          return <LandingPage onNavigate={handleNavigate} />;
      }
    }

    // Authenticated views
    switch (activeTab) {
      case 'inbox':
        return (
          <InboxConsole
            conversations={conversations}
            onUpdateConversation={handleUpdateConversation}
            onUpdateConversationStatus={handleUpdateConversationStatus}
          />
        );
      case 'catalog':
        return (
          <ProductCatalog 
            products={products}
            persona={persona}
            onAddProduct={handleAddProduct}
            onDeleteProduct={handleDeleteProduct}
            onSavePersona={handleSavePersona}
          />
        );
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'integrations':
        return (
          <IntegrationsHub 
            integrations={integrations}
            onToggleConnection={handleToggleIntegration}
            onRefreshAll={handleRefreshAllIntegrations}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            userProfile={{
              name: merchant?.name || '',
              email: merchant?.email || '',
              avatarUrl: merchant?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
            }}
            onUpdateProfile={handleUpdateProfile}
          />
        );
      default:
        return (
          <InboxConsole
            conversations={conversations}
            onUpdateConversation={handleUpdateConversation}
            onUpdateConversationStatus={handleUpdateConversationStatus}
          />
        );
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="bg-background min-h-screen w-full flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-on-surface overflow-x-hidden w-full max-w-full">
      {/* If authenticated, wrap in persistent Sidebar layout */}
      {isAuthenticated ? (
        <div className="flex w-full max-w-full overflow-x-hidden">
          {/* Sidebar Left Navigation */}
          <Sidebar 
            activeTab={activeTab} 
            onNavigate={handleNavigate} 
            onLogout={handleLogout} 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          />

          {/* Core Content Area */}
          <main className={`flex-grow pl-0 ${isSidebarCollapsed ? 'md:pl-16' : 'md:pl-64'} h-screen bg-[#060608] flex flex-col min-w-0 w-full overflow-hidden transition-all duration-300`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`w-full flex-grow flex flex-col ${activeTab === 'inbox' ? 'overflow-hidden h-full' : 'overflow-y-auto h-full scrollbar-thin scrollbar-thumb-white/10'}`}
              >
                {renderPageContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      ) : (
        /* If unauthenticated, render raw consumer view directly */
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            {renderPageContent()}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
