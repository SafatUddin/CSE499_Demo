import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Facebook,
  Instagram,
  MessageSquare,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  ShieldCheck,
  Smartphone,
  Check,
  Lock,
  Globe,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Integration } from '../types';
import {
  listChannels,
  disconnectChannel,
  getFacebookConnectUrl,
  getFacebookPendingPages,
  selectFacebookPage,
  FacebookPendingPage,
  getWhatsAppPendingNumbers,
  selectWhatsAppNumber,
  WhatsAppPendingNumber,
  connectWhatsAppChannel,
} from '../lib/api';
import DashboardHeader from './DashboardHeader';

interface IntegrationsHubProps {
  integrations: Integration[];
  onToggleConnection: (id: string) => void;
  onRefreshAll: () => Promise<void>;
}

export default function IntegrationsHub({ integrations, onToggleConnection, onRefreshAll }: IntegrationsHubProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Setup Wizard states
  const [activeWizardId, setActiveWizardId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);

  // Real Facebook, Instagram & WhatsApp connection state
  const [fbConnected, setFbConnected] = useState(false);
  const [fbPageName, setFbPageName] = useState<string | null>(null);
  const [fbPendingToken, setFbPendingToken] = useState<string | null>(null);
  const [fbPendingPages, setFbPendingPages] = useState<FacebookPendingPage[]>([]);
  const [fbError, setFbError] = useState('');
  const [isSelectingPage, setIsSelectingPage] = useState(false);

  const [igConnected, setIgConnected] = useState(false);
  const [igAccountName, setIgAccountName] = useState<string | null>(null);

  const [waConnected, setWaConnected] = useState(false);
  const [waPhoneName, setWaPhoneName] = useState<string | null>(null);
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waAccessToken, setWaAccessToken] = useState('');
  const [waError, setWaError] = useState('');
  const [isConnectingWa, setIsConnectingWa] = useState(false);
  const [waPendingToken, setWaPendingToken] = useState<string | null>(null);
  const [waPendingNumbers, setWaPendingNumbers] = useState<WhatsAppPendingNumber[]>([]);
  const [isSelectingWa, setIsSelectingWa] = useState(false);

  const refreshChannelsStatus = () => {
    listChannels()
      .then((channels) => {
        const facebook = channels.find((c) => c.type === 'facebook');
        setFbConnected(!!facebook?.connected);
        setFbPageName(facebook?.name || null);

        const instagram = channels.find((c) => c.type === 'instagram');
        setIgConnected(!!instagram?.connected);
        setIgAccountName(instagram?.name || null);

        const whatsapp = channels.find((c) => c.type === 'whatsapp');
        setWaConnected(!!whatsapp?.connected);
        setWaPhoneName(whatsapp?.name || null);
      })
      .catch((err) => console.error('Failed to load channel status:', err));
  };

  useEffect(() => {
    refreshChannelsStatus();

    // The OAuth callback redirects back here with query params in the hash
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return;
    const params = new URLSearchParams(hash.slice(queryIndex + 1));

    if (params.get('waConnected') || params.get('fbConnected')) {
      refreshChannelsStatus();
      window.history.replaceState(null, '', '#integrations');
    } else if (params.get('waPending')) {
      const token = params.get('waPending')!;
      setWaPendingToken(token);
      getWhatsAppPendingNumbers(token)
        .then((res) => setWaPendingNumbers(res.numbers))
        .catch(() => setWaError('That connection attempt expired. Please try connecting again.'));
      window.history.replaceState(null, '', '#integrations');
    } else if (params.get('fbPending')) {
      const token = params.get('fbPending')!;
      setFbPendingToken(token);
      getFacebookPendingPages(token)
        .then((res) => setFbPendingPages(res.pages))
        .catch(() => setFbError('That connection attempt expired. Please try connecting again.'));
      window.history.replaceState(null, '', '#integrations');
    } else if (params.get('fbError')) {
      const code = params.get('fbError');
      setFbError(
        code === 'no_pages'
          ? "We didn't find any Facebook Pages or WhatsApp Business accounts. Make sure your business is verified and try again."
          : code === 'denied'
            ? 'Permissions were not granted. Please try again.'
            : 'Failed to connect. Please try again.'
      );
      window.history.replaceState(null, '', '#integrations');
    }
  }, []);

  const handleFacebookCardClick = async () => {
    if (fbConnected) {
      try {
        await disconnectChannel('facebook');
        setFbConnected(false);
        setFbPageName(null);
        refreshChannelsStatus();
      } catch (err) {
        console.error('Failed to disconnect Facebook:', err);
      }
      return;
    }
    window.location.href = getFacebookConnectUrl();
  };

  const handleSelectFacebookPage = async (pageId: string) => {
    if (!fbPendingToken) return;
    setIsSelectingPage(true);
    try {
      await selectFacebookPage(fbPendingToken, pageId);
      setFbPendingToken(null);
      refreshChannelsStatus();
    } catch (err) {
      setFbError('Failed to select Facebook Page. Please try again.');
    } finally {
      setIsSelectingPage(false);
    }
  };

  const handleWhatsAppDisconnect = async () => {
    try {
      await disconnectChannel('whatsapp');
      setWaConnected(false);
      setWaPhoneName(null);
      refreshChannelsStatus();
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
    }
  };

  const handleSelectWhatsAppNumber = async (phoneNumberId: string) => {
    if (!waPendingToken) return;
    setIsSelectingWa(true);
    try {
      await selectWhatsAppNumber(waPendingToken, phoneNumberId);
      setWaPendingToken(null);
      setWaPendingNumbers([]);
      refreshChannelsStatus();
    } catch (err) {
      setWaError('Failed to select WhatsApp number. Please try again.');
    } finally {
      setIsSelectingWa(false);
    }
  };

  const handleSaveWhatsAppCredentials = async () => {
    if (!waPhoneNumberId.trim() || !waAccessToken.trim()) {
      setWaError('Phone Number ID and Access Token are required');
      return;
    }
    setWaError('');
    setIsConnectingWa(true);
    try {
      await connectWhatsAppChannel({
        phoneNumberId: waPhoneNumberId.trim(),
        accessToken: waAccessToken.trim(),
        phoneNumber: whatsappNumber.trim() || undefined,
      });
      setIsConnectingWa(false);
      setWaConnected(true);
      setWaPhoneName(whatsappNumber.trim() || waPhoneNumberId.trim());
      setWizardStep(2);
      refreshChannelsStatus();
    } catch (err: any) {
      setIsConnectingWa(false);
      setWaError(err.message || 'Failed to connect WhatsApp channel');
    }
  };

  const handleInstagramCardClick = async () => {
    if (igConnected) {
      try {
        await disconnectChannel('instagram');
        setIgConnected(false);
        setIgAccountName(null);
        refreshChannelsStatus();
      } catch (err) {
        console.error('Failed to disconnect Instagram:', err);
      }
      return;
    }
    window.location.href = getFacebookConnectUrl();
  };

  // Form states for Wizards
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('+1 (555) 019-2834');
  const [selectedFbPage, setSelectedFbPage] = useState('Aether Tech Labs');
  const [wooUrl, setWooUrl] = useState('https://mystore.wpcomstaging.com');
  const [wooConsumerKey, setWooConsumerKey] = useState('ck_91802b...');

  const triggerRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshAll();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  const handleConnectClick = (item: Integration) => {
    setActiveWizardId(item.id);
    setWizardStep(1);
    setIsSimulatingSync(false);
    setWaError('');
  };

  const handleCompleteWizard = (id: string) => {
    setIsSimulatingSync(true);
    setTimeout(() => {
      setIsSimulatingSync(false);
      onToggleConnection(id);
      setActiveWizardId(null);
    }, 2000);
  };

  // Render platform icon helper
  const renderIcon = (type: string, classStyle = "h-5 w-5") => {
    switch (type) {
      case 'facebook':
        return <Facebook className={classStyle} />;
      case 'instagram':
        return <Instagram className={classStyle} />;
      case 'whatsapp':
        return <MessageSquare className={classStyle} />;
      case 'shopify':
        return <ShoppingBag className={classStyle} />;
      case 'woocommerce':
        return <Database className={classStyle} />;
      default:
        return <Database className={classStyle} />;
    }
  };

  // Overlay real Facebook, Instagram & WhatsApp connection states onto the integration list
  const displayIntegrations = integrations.map((item) => {
    if (item.id === 'int-fb') {
      return {
        ...item,
        connected: fbConnected,
        statusText: fbConnected ? (fbPageName ? `Connected: ${fbPageName}` : 'Active Sync') : 'Not Connected',
      };
    }
    if (item.id === 'int-ig') {
      return {
        ...item,
        connected: igConnected,
        statusText: igConnected ? (igAccountName ? `Connected: ${igAccountName}` : 'Active Sync') : 'Not Connected',
      };
    }
    if (item.id === 'int-wa') {
      return {
        ...item,
        connected: waConnected,
        statusText: waConnected ? (waPhoneName ? `Connected: ${waPhoneName}` : 'Active Sync') : 'Not Connected',
      };
    }
    return item;
  });

  // Filter based on search term
  const filteredIntegrations = displayIntegrations.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      
      {/* Header section with search binded directly */}
      <DashboardHeader 
        title="Integrations Hub" 
        searchPlaceholder="Search extensions..." 
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 lg:py-10 w-full flex-grow space-y-6 pb-16">
        {fbError && (
          <div className="bg-[#ea4335]/10 border border-[#ea4335]/20 text-[#ea4335] text-[11px] p-3 rounded-lg flex items-center justify-between font-sans">
            <span>{fbError}</span>
            <button onClick={() => setFbError('')} className="text-[#ea4335] hover:text-white cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Connectivity Banner Content */}
      <div className="space-y-4">
        {/* Global Connectivity Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-[10px] uppercase tracking-widest text-white/60 font-sans font-bold w-max mb-2">
          <Globe className="h-3.5 w-3.5 text-white/50" />
          Global Ecosystem Connectivity
        </div>

        {/* Main large typography */}
        <h2 className="text-4xl md:text-5xl font-sans font-extrabold text-white tracking-tight leading-tight">
          Unify your sales channels
        </h2>

        {/* Dynamic subtitle */}
        <p className="text-sm text-white/50 max-w-2xl leading-relaxed font-sans">
          ShopMate AI bridges your external platforms directly into our elite sales command center. Manage inventory, automate responses, and track performance from a single source of truth.
        </p>
      </div>

      {/* Grid of Connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-8">
        {filteredIntegrations.map((item) => {
          const isWhatsApp = item.id === 'int-wa';
          const isWooCommerce = item.id === 'int-woo';
          
          return (
            <div 
              key={item.id}
              className={`flex flex-col justify-between h-[250px] p-6 rounded-xl transition-all duration-300 relative group overflow-hidden ${
                isWooCommerce 
                  ? 'border border-dashed border-white/20 bg-[#0c0c0e]/40' 
                  : isWhatsApp 
                    ? 'border border-red-500/10 hover:border-red-500/25 bg-[#0e0909]/80 shadow-lg shadow-red-500/[0.02]' 
                    : 'border border-white/[0.06] bg-[#0c0c0e]/80 hover:border-white/[0.12]'
              }`}
            >
              <div>
                {/* Card Top Row: Icon Container and Connection Badge */}
                <div className="flex justify-between items-start">
                  
                  {/* Platform Icon Box */}
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 duration-300 ${
                    item.id === 'int-fb'
                      ? 'bg-[#1877f2]/10 border border-[#1877f2]/20 text-[#1877f2]'
                      : item.id === 'int-shopify'
                        ? 'bg-[#96bf48]/10 border border-[#96bf48]/20 text-[#96bf48]'
                        : 'bg-white/[0.05] border border-white/[0.08] text-white/80'
                  }`}>
                    {renderIcon(item.logoType, "h-5 w-5")}
                  </div>

                  {/* Status Badge Tag */}
                  <div>
                    {item.connected ? (
                      <span className="inline-flex items-center text-[9px] font-sans font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] font-sans font-bold text-white/45 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
                        Not Connected
                      </span>
                    )}
                  </div>

                </div>

                {/* Card Details: Title and Description */}
                <h3 className="font-sans font-bold text-[18px] text-white tracking-tight mt-4">
                  {item.name}
                </h3>
                
                <p className="text-white/50 text-[12px] leading-relaxed mt-1 font-sans line-clamp-3">
                  {item.description}
                </p>
              </div>

              {/* Bottom footer & Action button */}
              <div className="border-t border-white/[0.04] pt-3.5 flex justify-between items-center">
                <span className="font-sans text-xs text-white/45">
                  {item.statusText}
                </span>

                <button
                  onClick={() => {
                    if (item.id === 'int-fb') {
                      handleFacebookCardClick();
                    } else if (item.id === 'int-ig') {
                      handleInstagramCardClick();
                    } else if (item.id === 'int-wa') {
                      if (waConnected) {
                        handleWhatsAppDisconnect();
                      } else {
                        handleConnectClick(item);
                      }
                    } else {
                      handleConnectClick(item);
                    }
                  }}
                  className={`font-sans text-xs font-bold px-3 py-1.5 rounded-lg tracking-wide transition-all active:scale-[0.98] cursor-pointer ${
                    isWhatsApp && !waConnected
                      ? 'bg-white hover:bg-white/90 text-black'
                      : 'bg-transparent hover:bg-white/5 border border-white/10 text-white'
                  }`}
                >
                  {item.id === 'int-fb' ? (item.connected ? 'Disconnect' : 'Connect') : item.id === 'int-ig' ? (item.connected ? 'Disconnect' : 'Connect') : isWhatsApp ? (waConnected ? 'Disconnect' : 'Connect') : 'Manage'}
                </button>
              </div>

            </div>
          );
        })}

        {/* INTEGRATION INSIGHT Card - always present at the end of the grid layout */}
        <div className="bg-[#0e0e11] border border-white/[0.06] rounded-xl p-6 flex flex-col justify-between h-[250px] relative overflow-hidden group">
          
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.01] pointer-events-none" />

          {/* Top Label */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-sans font-bold text-white/40 uppercase tracking-widest">System Insight</span>
          </div>

          {/* Bottom Action */}
          <div className="border-t border-white/[0.04] pt-3">
            <span className="text-[11px] font-sans text-white/40 hover:text-white/70 transition-colors cursor-pointer flex items-center gap-1.5">
              Read architecture docs &rarr;
            </span>
          </div>
        </div>

      </div>

      {/* SETUP WIZARDS DIALOGS BACKDROP OVERLAY MODAL */}
      <AnimatePresence>
        {activeWizardId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-[#0d0d0d] border border-white/10 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col text-left"
            >
              
              {/* Wizard Modal Header */}
              <header className="p-5 border-b border-white/5 bg-[#111111] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#070707] border border-white/10 rounded-lg">
                    {renderIcon(integrations.find(i => i.id === activeWizardId)?.logoType || '', "h-5 w-5 text-white/90")}
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-white">
                      Setup {integrations.find(i => i.id === activeWizardId)?.name}
                    </h4>
                    <p className="font-mono text-[8px] text-white/40 uppercase tracking-widest mt-0.5">
                      ShopMate Channel Adapter v1.1
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveWizardId(null)}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Wizard Form/Content container */}
              <div className="p-6 space-y-6 flex-grow">
                {isSimulatingSync ? (
                  /* SIMULATING LIVE API NODE PAIRING AND DATABASE INDEXING */
                  <div className="py-8 text-center space-y-4">
                    <RefreshCw className="h-10 w-10 text-white animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="font-mono text-[9px] text-white/80 uppercase tracking-[0.2em] font-bold">
                        INDEXING DATA STRUCTURES...
                      </p>
                      <p className="text-xs text-white/50 font-sans max-w-sm mx-auto leading-relaxed">
                        Establishing webhook endpoint connection and training local ShopMate LLM neural weights with your digital shop catalog data...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* STEP INDEX */}
                    <div className="flex items-center gap-3 justify-center mb-4">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold border transition-all ${
                            wizardStep === step 
                              ? 'bg-white border-transparent text-black' 
                              : wizardStep > step 
                                ? 'bg-white/20 border-white/30 text-white/90' 
                                : 'bg-transparent border-white/10 text-white/30'
                          }`}>
                            {wizardStep > step ? <Check className="h-3 w-3" /> : step}
                          </div>
                          {step < 3 && <div className={`w-8 h-0.5 ${wizardStep > step ? 'bg-white/30' : 'bg-white/10'}`} />}
                        </div>
                      ))}
                    </div>

                    {/* WIZARD PATHS BASED ON CHOSEN PLUGIN TYPE */}

                    {/* PATH A: INSTAGRAM (Facebook now uses the real OAuth flow, not this wizard) */}
                    {activeWizardId === 'int-ig' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-4 text-center py-4">
                            <Facebook className="h-12 w-12 text-[#1877F2] mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-semibold text-white">OAuth Secure Authentication</h5>
                              <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                                Log in with your Facebook account. ShopMate requests scopes to process incoming Page messaging and Instagram DMs automatically.
                              </p>
                            </div>
                            <button 
                              onClick={() => setWizardStep(2)}
                              className="bg-[#1877F2] hover:bg-blue-600 text-white font-sans text-xs font-semibold px-6 py-3 rounded-lg flex items-center gap-2 mx-auto cursor-pointer shadow-md"
                            >
                              Connect via Facebook OAuth
                            </button>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4">
                            <h5 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">Select Page Access Target</h5>
                            <p className="text-xs text-white/50 leading-relaxed">
                              Choose which Meta Business page catalog and message feed ShopMate AI should listen to:
                            </p>
                            <div className="space-y-2">
                              {['Aether Tech Labs', 'Composite Apparel Hub', 'Symphony Audio Labs'].map((pageName) => (
                                <button
                                  key={pageName}
                                  onClick={() => setSelectedFbPage(pageName)}
                                  className={`w-full p-3 text-left border rounded-lg flex justify-between items-center transition-all ${
                                    selectedFbPage === pageName 
                                      ? 'bg-white/[0.06] border-white/20' 
                                      : 'bg-[#060606] border-white/5 hover:border-white/10'
                                  }`}
                                >
                                  <span className="text-xs text-white font-sans font-medium">{pageName}</span>
                                  {selectedFbPage === pageName && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </button>
                              ))}
                            </div>
                            <button 
                              onClick={() => setWizardStep(3)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer mt-4"
                            >
                              Grant Channel Scopes
                            </button>
                          </div>
                        )}

                        {wizardStep === 3 && (
                          <div className="space-y-4 text-center py-4">
                            <ShieldCheck className="h-12 w-12 text-white mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-semibold text-white">Permissions Confirmed</h5>
                              <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                                ShopMate AI has securely established webhook connections to Page: <strong className="text-white">{selectedFbPage}</strong>.<br />Ready to initiate initial product catalog embedding.
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer mt-4"
                            >
                              Sync Page Catalog & Complete
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PATH B: WHATSAPP BUSINESS — DUAL MODE */}
                    {activeWizardId === 'int-wa' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-5">
                            {/* ── Header ── */}
                            <div className="text-center py-1 space-y-1.5">
                              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                                <MessageSquare className="h-6 w-6 text-emerald-400" />
                              </div>
                              <h5 className="text-sm font-semibold text-white">Connect WhatsApp Business</h5>
                              <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                                Link your WhatsApp Business account so ShopMate AI can send and receive customer messages automatically.
                              </p>
                            </div>

                            {waError && (
                              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs leading-relaxed">
                                {waError}
                              </div>
                            )}

                            {/* ── RECOMMENDED: Meta OAuth ── */}
                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-sans font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                  Recommended
                                </span>
                                <span className="text-[10px] text-white/40 font-sans">For all merchants</span>
                              </div>

                              <div>
                                <h6 className="text-xs font-semibold text-white mb-1">Sign in with Meta</h6>
                                <p className="text-[11px] text-white/50 leading-relaxed">
                                  Click below — Meta's login will guide you through selecting your WhatsApp Business number. No tokens or IDs required.
                                </p>
                              </div>

                              <button
                                onClick={() => { window.location.href = getFacebookConnectUrl(); }}
                                className="w-full flex items-center justify-center gap-2.5 bg-[#1877f2] hover:bg-[#1565d8] text-white font-sans text-xs font-bold py-3 rounded-lg cursor-pointer transition-colors"
                              >
                                <Facebook className="h-4 w-4" />
                                Continue with Meta
                              </button>
                            </div>

                            {/* ── DIVIDER ── */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-white/[0.06]" />
                              <span className="text-[10px] text-white/30 font-sans uppercase tracking-widest">or</span>
                              <div className="flex-1 h-px bg-white/[0.06]" />
                            </div>

                            {/* ── DEVELOPER: Manual Credentials ── */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 mb-3">
                                <Lock className="h-3.5 w-3.5 text-white/30" />
                                <span className="text-[11px] text-white/40 font-sans font-semibold">Developer / Test Number Setup</span>
                              </div>
                              <p className="text-[10px] text-white/30 leading-relaxed mb-3">
                                Use this only if you have a Meta Developer App with a test phone number.
                              </p>

                              <div className="space-y-2.5">
                                <div className="space-y-1.5">
                                  <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">
                                    Phone Number ID <span className="text-red-400">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 10528492049102"
                                    value={waPhoneNumberId}
                                    onChange={(e) => setWaPhoneNumberId(e.target.value)}
                                    className="w-full bg-[#050505] border border-white/10 rounded-lg p-2.5 font-mono text-xs text-white focus:border-white/30 outline-none"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">
                                    Temporary Access Token <span className="text-red-400">*</span>
                                  </label>
                                  <textarea
                                    placeholder="e.g. EAAG..."
                                    rows={2}
                                    value={waAccessToken}
                                    onChange={(e) => setWaAccessToken(e.target.value)}
                                    className="w-full bg-[#050505] border border-white/10 rounded-lg p-2.5 font-mono text-xs text-white focus:border-white/30 outline-none resize-none"
                                  />
                                </div>
                              </div>

                              <button
                                onClick={handleSaveWhatsAppCredentials}
                                disabled={isConnectingWa || (!waPhoneNumberId.trim() || !waAccessToken.trim())}
                                className="w-full mt-2 bg-white/[0.06] hover:bg-white/[0.10] disabled:opacity-40 border border-white/10 text-white font-sans text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2"
                              >
                                {isConnectingWa ? 'Connecting...' : 'Connect via API Keys'}
                              </button>
                            </div>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4 text-center py-4">
                            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-semibold text-white">WhatsApp Business Connected</h5>
                              <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                                Your WhatsApp channel is now live. ShopMate AI will handle incoming messages and send replies automatically.
                              </p>
                            </div>
                            <button
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer"
                            >
                              Done & Return to Integrations
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PATH C: SHOPIFY WEBHOOK SYNC */}
                    {activeWizardId === 'int-shopify' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-4">
                            <div className="text-center py-2 space-y-1">
                              <ShoppingBag className="h-10 w-10 text-[#96BF48] mx-auto" />
                              <h5 className="text-sm font-semibold text-white font-serif">Shopify Store Catalog Pairing</h5>
                              <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                                Enter your Shopify Store domain to install our secure cloud integration adapter.
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">Shopify Domain</label>
                              <input
                                type="text"
                                placeholder="my-boutique.myshopify.com"
                                value={shopifyDomain}
                                onChange={(e) => setShopifyDomain(e.target.value)}
                                className="w-full bg-[#050505] border border-white/10 rounded-lg p-3 font-sans text-xs text-white focus:border-white/30 outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                if (shopifyDomain.trim()) setWizardStep(2);
                              }}
                              disabled={!shopifyDomain.trim()}
                              className="w-full bg-[#96BF48] hover:bg-green-600 disabled:opacity-50 text-white font-sans text-xs font-semibold py-3 rounded-lg cursor-pointer flex justify-center items-center gap-1.5"
                            >
                              <Lock className="h-3.5 w-3.5" /> Authorize with Shopify
                            </button>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4">
                            <h5 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">Confirm Security Scopes</h5>
                            <p className="text-xs text-white/50 leading-relaxed">
                              ShopMate AI requires standard merchant access to handle automated checkout carts:
                            </p>
                            <div className="space-y-2 bg-[#050505] border border-white/5 p-3 rounded-lg">
                              {[
                                'read_products / sync titles, SKUs, pricing',
                                'read_inventory / verify real-time stock levels',
                                'write_orders / post checkout conversions directly'
                              ].map((scope, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-white/70">
                                  <ShieldCheck className="h-4 w-4 text-white flex-shrink-0" />
                                  <span className="font-mono text-[10px]">{scope}</span>
                                </div>
                              ))}
                            </div>
                            <button 
                              onClick={() => setWizardStep(3)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer mt-4"
                            >
                              Install Shopify Merchant Plugin
                            </button>
                          </div>
                        )}

                        {wizardStep === 3 && (
                          <div className="space-y-4 text-center py-4">
                            <CheckCircle2 className="h-12 w-12 text-[#96BF48] mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-semibold text-white">Install Complete</h5>
                              <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                                Connection verified. Ready to synchronise catalog SKU embeddings (1,240 items flagged) and begin live lead training.
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer"
                            >
                              Index Catalog Embeddings & Live Deploy
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PATH D: WOOCOMMERCE KEY SYNC */}
                    {activeWizardId === 'int-woo' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-4">
                            <div className="text-center py-2 space-y-1">
                              <ShoppingBag className="h-10 w-10 text-[#7F54B3] mx-auto" />
                              <h5 className="text-sm font-semibold text-white font-serif">WooCommerce REST API Setup</h5>
                              <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                                Synchronize your WordPress WooCommerce catalog by linking secure read-only REST API keys.
                              </p>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">WordPress Store URL</label>
                                <input
                                  type="text"
                                  value={wooUrl}
                                  onChange={(e) => setWooUrl(e.target.value)}
                                  className="w-full bg-[#050505] border border-white/10 rounded-lg p-2.5 font-sans text-xs text-white focus:border-white/30 outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">Consumer Key</label>
                                <input
                                  type="password"
                                  value={wooConsumerKey}
                                  onChange={(e) => setWooConsumerKey(e.target.value)}
                                  className="w-full bg-[#050505] border border-white/10 rounded-lg p-2.5 font-sans text-xs text-white focus:border-white/30 outline-none"
                                />
                              </div>
                            </div>
                            <button 
                              onClick={() => setWizardStep(2)}
                              className="w-full bg-[#7F54B3] hover:bg-purple-600 text-white font-sans text-xs font-semibold py-3 rounded-lg cursor-pointer flex justify-center items-center gap-1.5"
                            >
                              Verify API Authorization Key
                            </button>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4 text-center py-4">
                            <ShieldCheck className="h-12 w-12 text-[#7F54B3] mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-semibold text-white">WooCommerce Credentials Verified</h5>
                              <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                                REST endpoints verified. Webhook handlers registered for continuous price, inventory, and order updates.
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer"
                            >
                              Sync WooCommerce Store catalog
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Facebook multi-Page picker — shown when the merchant manages more than one Page */}
      <AnimatePresence>
        {fbPendingToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-[#0d0d0d] border border-white/10 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col text-left"
            >
              <header className="p-5 border-b border-white/5 bg-[#111111] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#070707] border border-white/10 rounded-lg">
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-white">Select a Facebook Page</h4>
                    <p className="font-mono text-[8px] text-white/40 uppercase tracking-widest mt-0.5">
                      You manage more than one Page
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setFbPendingToken(null); setFbPendingPages([]); }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="p-6 space-y-3">
                <p className="text-xs text-white/50 leading-relaxed">
                  Choose which Page ShopMate AI should connect to:
                </p>
                {fbPendingPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handleSelectFacebookPage(page.id)}
                    disabled={isSelectingPage}
                    className="w-full p-3 text-left border rounded-lg flex justify-between items-center transition-all bg-[#060606] border-white/5 hover:border-white/20 cursor-pointer disabled:opacity-50"
                  >
                    <span className="text-xs text-white font-sans font-medium">{page.name}</span>
                    <ChevronRight className="h-4 w-4 text-white/40" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp multi-number picker — shown when merchant has >1 phone number */}
      <AnimatePresence>
        {waPendingToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-[#0d0d0d] border border-white/10 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col text-left"
            >
              <header className="p-5 border-b border-white/5 bg-[#111111] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-white">Select a WhatsApp Number</h4>
                    <p className="font-mono text-[8px] text-white/40 uppercase tracking-widest mt-0.5">
                      Multiple numbers found — choose one
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setWaPendingToken(null); setWaPendingNumbers([]); }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="p-6 space-y-3">
                <p className="text-xs text-white/50 leading-relaxed">
                  Choose which WhatsApp Business number ShopMate AI should connect to:
                </p>
                {waError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">
                    {waError}
                  </div>
                )}
                {waPendingNumbers.map((num) => (
                  <button
                    key={num.id}
                    onClick={() => handleSelectWhatsAppNumber(num.id)}
                    disabled={isSelectingWa}
                    className="w-full p-3 text-left border rounded-lg flex justify-between items-center transition-all bg-[#060606] border-white/5 hover:border-emerald-500/30 cursor-pointer disabled:opacity-50"
                  >
                    <div>
                      <span className="text-xs text-white font-sans font-medium block">{num.display_phone_number}</span>
                      {num.name && <span className="text-[10px] text-white/40 font-sans">{num.name}</span>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
