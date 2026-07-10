import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Tab, Product, Integration, AIPersona, Conversation, ChatMessage } from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_INTEGRATIONS, 
  DEFAULT_AI_PERSONA, 
  INITIAL_CONVERSATIONS 
} from './data/mockData';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('landing');

  // User Profile State synchronized with localStorage
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('shopmate_user_profile');
    return saved ? JSON.parse(saved) : {
      name: "Mara K.",
      email: "merchant@shopmate.ai",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
      password: "password123"
    };
  });

  // Listen to custom header actions for seamless routing & logging out
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const tab = (e as CustomEvent).detail as Tab;
      setActiveTab(tab);
    };
    const handleLogoutEvent = () => {
      handleLogout();
    };
    window.addEventListener('shopmate_navigate', handleNavigateEvent);
    window.addEventListener('shopmate_logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('shopmate_navigate', handleNavigateEvent);
      window.removeEventListener('shopmate_logout', handleLogoutEvent);
    };
  }, []);

  const handleUpdateProfile = (updates: Partial<typeof userProfile>) => {
    const updated = { ...userProfile, ...updates };
    setUserProfile(updated);
    localStorage.setItem('shopmate_user_profile', JSON.stringify(updated));
    // Dispatch event so any other listening components (like header) are updated instantly
    window.dispatchEvent(new Event('shopmate_profile_updated'));
  };

  // Application Data States
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [persona, setPersona] = useState<AIPersona>(DEFAULT_AI_PERSONA);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);

  // Navigation controller
  const handleNavigate = (tab: Tab) => {
    setActiveTab(tab);
  };

  // Auth simulators
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActiveTab('inbox');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('landing');
  };

  // Product mutations
  const handleAddProduct = (newProduct: Omit<Product, 'id'>) => {
    const productWithId: Product = {
      ...newProduct,
      id: `p-${Date.now()}`
    };
    setProducts((prev) => [productWithId, ...prev]);
  };

  const handleDeleteProduct = (id: string) => {
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
  const handleSavePersona = (newPersona: AIPersona) => {
    setPersona(newPersona);
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

  const handleUpdateConversationStatus = (chatId: string, status: 'Active' | 'AI Managed' | 'Closed') => {
    setConversations((prev) => prev.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          status
        };
      }
      return chat;
    }));
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
              onLoginSuccess={handleLoginSuccess} 
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
            />
          );
        case 'signup':
          return <SignupPage onNavigate={handleNavigate} onSignupSuccess={handleLoginSuccess} />;
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
            products={products}
            persona={persona}
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
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
          />
        );
      default:
        return (
          <InboxConsole 
            conversations={conversations}
            products={products}
            persona={persona}
            onUpdateConversation={handleUpdateConversation}
            onUpdateConversationStatus={handleUpdateConversationStatus}
          />
        );
    }
  };

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
          />

          {/* Core Content Area */}
          <main className="flex-grow pl-64 min-h-screen bg-[#060608] flex flex-col min-w-0 w-full overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full flex-grow flex flex-col"
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
