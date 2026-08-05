import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Facebook,
  Instagram,
  MessageSquare,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  Database,
  ShieldCheck,
  Check,
  Lock,
  Globe,
  X,
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
      setFbError('Failed to select Facebook page. Please try again.');
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
      setWaError('Phone number ID and access token are required');
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

  const [shopifyDomain, setShopifyDomain] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('+1 (555) 019-2834');
  const [selectedFbPage, setSelectedFbPage] = useState('Aether Tech Labs');
  const [wooUrl, setWooUrl] = useState('https://mystore.wpcomstaging.com');
  const [wooConsumerKey, setWooConsumerKey] = useState('ck_91802b...');

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

  const displayIntegrations = integrations.map((item) => {
    if (item.id === 'int-fb') {
      return {
        ...item,
        connected: fbConnected,
        statusText: fbConnected ? (fbPageName ? `Connected: ${fbPageName}` : 'Active sync') : 'Not connected',
      };
    }
    if (item.id === 'int-ig') {
      return {
        ...item,
        connected: igConnected,
        statusText: igConnected ? (igAccountName ? `Connected: ${igAccountName}` : 'Active sync') : 'Not connected',
      };
    }
    if (item.id === 'int-wa') {
      return {
        ...item,
        connected: waConnected,
        statusText: waConnected ? (waPhoneName ? `Connected: ${waPhoneName}` : 'Active sync') : 'Token expired',
      };
    }
    return item;
  });

  const filteredIntegrations = displayIntegrations.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      <DashboardHeader 
        searchPlaceholder="Search extensions…" 
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="w-full flex-grow space-y-6 p-6 md:p-8 pb-16">
        {fbError && (
          <div className="status-danger text-xs p-3.5 rounded-xl flex items-center justify-between font-sans">
            <span>{fbError}</span>
            <button onClick={() => setFbError('')} className="text-[#ff9d92] hover:text-white cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

      {/* Connectivity Banner Content (§8) */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/[0.05] border border-white/12 rounded-full text-[11px] font-bold text-white/70 font-sans tracking-[0.10em]">
          <Globe className="h-4 w-4 text-[#7aa8ff]" />
          Channel ecosystem
        </div>

        <h2 className="text-[44px] font-[800] tracking-[-0.03em] text-white leading-tight font-sans">
          Unify your sales channels
        </h2>

        <p className="text-sm text-white/60 max-w-2xl leading-relaxed font-sans">
          Connect your social messaging pages and store platforms directly into ShopMate AI. Automate replies, sync product catalogs, and finalize orders from a single interface.
        </p>
      </div>

      {/* Grid of Connections (§8) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {filteredIntegrations.map((item) => {
          const isWhatsApp = item.id === 'int-wa';
          const isNotConnected = !item.connected;
          const isWhatsAppError = isWhatsApp && !waConnected;
          
          return (
            <div 
              key={item.id}
              className={`flex flex-col justify-between h-[260px] p-6 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                isWhatsAppError 
                  ? 'status-danger border-red-500/30' 
                  : isNotConnected 
                    ? 'zone-b-grey2 border border-dashed border-white/16 hover:border-white/30' 
                    : 'zone-b-grey2 hover:border-white/24'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300 ${
                    item.id === 'int-fb'
                      ? 'bg-[#1877f2]/15 border border-[#1877f2]/30 text-[#1877f2]'
                      : item.id === 'int-shopify'
                        ? 'bg-[#96bf48]/15 border border-[#96bf48]/30 text-[#96bf48]'
                        : 'bg-white/10 border border-white/15 text-white/90'
                  }`}>
                    {renderIcon(item.logoType, "h-6 w-6")}
                  </div>

                  <div>
                    {item.connected ? (
                      <span className="status-success px-2.5 py-1 text-[11px] font-bold rounded-full">
                        Connected
                      </span>
                    ) : isWhatsAppError ? (
                      <span className="status-danger px-2.5 py-1 text-[11px] font-bold rounded-full">
                        Action required
                      </span>
                    ) : (
                      <span className="status-neutral px-2.5 py-1 text-[11px] font-bold rounded-full">
                        Not connected
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="font-sans font-bold text-[19px] text-white tracking-tight mt-5">
                  {item.name}
                </h3>
                
                <p className="text-white/60 text-xs leading-relaxed mt-1 font-sans line-clamp-3">
                  {item.description}
                </p>
              </div>

              <div className="border-t border-white/[0.07] pt-4 flex justify-between items-center">
                <span className="font-sans text-xs text-white/50">
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
                  className={`font-sans text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    isWhatsAppError
                      ? 'btn-light-primary'
                      : item.connected
                        ? 'btn-glass'
                        : 'btn-accent'
                  }`}
                >
                  {item.id === 'int-fb' ? (item.connected ? 'Disconnect' : 'Connect') : item.id === 'int-ig' ? (item.connected ? 'Disconnect' : 'Connect') : isWhatsApp ? (waConnected ? 'Disconnect' : 'Connect') : 'Manage'}
                </button>
              </div>
            </div>
          );
        })}

        {/* System Insight Card (§8) */}
        <div className="zone-b-grey2 border border-dashed border-white/16 rounded-2xl p-6 flex flex-col justify-between h-[260px] relative overflow-hidden group">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3ddc84] shadow-[0_0_8px_rgba(61,220,132,0.9)] animate-pulse-dot" />
            <span className="text-xs font-sans font-bold text-white/50 tracking-[0.10em]">System insight</span>
          </div>

          <p className="text-xs text-white/60 leading-relaxed font-sans">
            Webhooks are continuously monitored. Channel events automatically reflect inside your ShopMate AI Inbox thread within milliseconds.
          </p>

          <div className="border-t border-white/[0.07] pt-3">
            <span className="text-xs font-sans text-[#7aa8ff] hover:underline cursor-pointer flex items-center gap-1.5">
              Read integration documentation &rarr;
            </span>
          </div>
        </div>

      </div>

      {/* SETUP WIZARDS DIALOGS OVERLAY */}
      <AnimatePresence>
        {activeWizardId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="zone-b-grey3 border border-white/20 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col text-left"
            >
              <header className="p-5 border-b border-white/[0.07] bg-black/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 border border-white/15 rounded-xl">
                    {renderIcon(integrations.find(i => i.id === activeWizardId)?.logoType || '', "h-5 w-5 text-white")}
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-base text-white">
                      Setup {integrations.find(i => i.id === activeWizardId)?.name}
                    </h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      ShopMate channel adapter v1.1
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveWizardId(null)}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-6 space-y-6 flex-grow">
                {isSimulatingSync ? (
                  <div className="py-8 text-center space-y-4">
                    <RefreshCw className="h-10 w-10 text-[#4d8bff] animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="font-sans text-xs text-white font-bold tracking-wider">
                        Indexing data structures…
                      </p>
                      <p className="text-xs text-white/50 font-sans max-w-sm mx-auto leading-relaxed">
                        Establishing webhook endpoint connection and indexing store data into ShopMate AI context…
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 justify-center mb-4">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-sans text-xs font-bold transition-all ${
                            wizardStep === step 
                              ? 'btn-accent text-white' 
                              : wizardStep > step 
                                ? 'bg-white/20 text-white' 
                                : 'bg-white/5 text-white/30 border border-white/10'
                          }`}>
                            {wizardStep > step ? <Check className="h-3.5 w-3.5" /> : step}
                          </div>
                          {step < 3 && <div className={`w-8 h-0.5 ${wizardStep > step ? 'bg-white/30' : 'bg-white/10'}`} />}
                        </div>
                      ))}
                    </div>

                    {activeWizardId === 'int-ig' && (
                      <div className="space-y-4 text-center py-4">
                        <Facebook className="h-12 w-12 text-[#1877F2] mx-auto" />
                        <div className="space-y-1.5">
                          <h5 className="text-sm font-bold text-white font-sans">OAuth authentication</h5>
                          <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed font-sans">
                            Sign in with your Facebook account to grant ShopMate AI access to process incoming Instagram messages.
                          </p>
                        </div>
                        <button 
                          onClick={() => { window.location.href = getFacebookConnectUrl(); }}
                          className="btn-accent px-6 py-3 text-xs font-bold flex items-center gap-2 mx-auto cursor-pointer"
                        >
                          Connect via Meta OAuth
                        </button>
                      </div>
                    )}

                    {activeWizardId === 'int-wa' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-5">
                            <div className="text-center py-1 space-y-1.5">
                              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
                                <MessageSquare className="h-6 w-6 text-emerald-400" />
                              </div>
                              <h5 className="text-base font-bold text-white font-sans">Connect WhatsApp Business</h5>
                              <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto font-sans">
                                Link your WhatsApp Business account so ShopMate AI can automate customer responses.
                              </p>
                            </div>

                            {waError && (
                              <div className="status-danger text-xs p-3 rounded-xl leading-relaxed font-sans">
                                {waError}
                              </div>
                            )}

                            <div className="zone-b-grey2 p-4 rounded-2xl space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="status-success px-2 py-0.5 text-[10.5px] font-bold rounded-full">
                                  Recommended
                                </span>
                              </div>

                              <div>
                                <h6 className="text-xs font-bold text-white font-sans">Sign in with Meta</h6>
                                <p className="text-xs text-white/50 leading-relaxed font-sans mt-0.5">
                                  Meta login automatically detects your WhatsApp Business numbers. No tokens required.
                                </p>
                              </div>

                              <button
                                onClick={() => { window.location.href = getFacebookConnectUrl(); }}
                                className="w-full flex items-center justify-center gap-2.5 bg-[#1877f2] hover:bg-[#1565d8] text-white font-sans text-xs font-bold py-3 rounded-xl cursor-pointer transition-colors shadow-md"
                              >
                                <Facebook className="h-4 w-4" />
                                Continue with Meta
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-white/10" />
                              <span className="text-[11px] text-white/40 font-sans">or</span>
                              <div className="flex-1 h-px bg-white/10" />
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <label className="font-sans text-xs text-white/60 font-semibold block">
                                  Phone number ID
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 10528492049102"
                                  value={waPhoneNumberId}
                                  onChange={(e) => setWaPhoneNumberId(e.target.value)}
                                  className="w-full zone-b-input p-2.5 text-xs font-mono outline-none"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="font-sans text-xs text-white/60 font-semibold block">
                                  Access token
                                </label>
                                <textarea
                                  placeholder="e.g. EAAG…"
                                  rows={2}
                                  value={waAccessToken}
                                  onChange={(e) => setWaAccessToken(e.target.value)}
                                  className="w-full zone-b-input p-2.5 text-xs font-mono outline-none resize-none"
                                />
                              </div>

                              <button
                                onClick={handleSaveWhatsAppCredentials}
                                disabled={isConnectingWa || (!waPhoneNumberId.trim() || !waAccessToken.trim())}
                                className="w-full btn-glass py-2.5 text-xs font-bold cursor-pointer disabled:opacity-40"
                              >
                                {isConnectingWa ? 'Connecting…' : 'Connect via API keys'}
                              </button>
                            </div>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4 text-center py-4">
                            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-base font-bold text-white font-sans">WhatsApp Business connected</h5>
                              <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed font-sans">
                                Your WhatsApp channel is live. ShopMate AI will process incoming inquiries automatically.
                              </p>
                            </div>
                            <button
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full btn-light-primary py-3 text-xs font-bold cursor-pointer"
                            >
                              Return to integrations
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeWizardId === 'int-shopify' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-4">
                            <div className="text-center py-2 space-y-1">
                              <ShoppingBag className="h-10 w-10 text-[#96BF48] mx-auto" />
                              <h5 className="text-base font-bold text-white font-sans">Shopify store catalog pairing</h5>
                              <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto font-sans">
                                Enter your Shopify domain to link catalog inventory with ShopMate AI.
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="font-sans text-xs text-white/60 font-semibold block">Shopify domain</label>
                              <input
                                type="text"
                                placeholder="my-boutique.myshopify.com"
                                value={shopifyDomain}
                                onChange={(e) => setShopifyDomain(e.target.value)}
                                className="w-full zone-b-input p-3 text-xs outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => { if (shopifyDomain.trim()) setWizardStep(2); }}
                              disabled={!shopifyDomain.trim()}
                              className="w-full btn-accent py-3 text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              Authorize with Shopify
                            </button>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4">
                            <h5 className="text-xs font-bold text-white font-sans">Confirm security permissions</h5>
                            <div className="space-y-2 zone-b-grey2 p-3.5 rounded-xl">
                              {[
                                'read_products / sync SKUs and pricing',
                                'read_inventory / verify stock levels',
                                'write_orders / post checkout conversions'
                              ].map((scope, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-white/70 font-sans">
                                  <ShieldCheck className="h-4 w-4 text-[#7aa8ff] flex-shrink-0" />
                                  <span>{scope}</span>
                                </div>
                              ))}
                            </div>
                            <button 
                              onClick={() => setWizardStep(3)}
                              className="w-full btn-light-primary py-3 text-xs font-bold cursor-pointer"
                            >
                              Install Shopify adapter
                            </button>
                          </div>
                        )}

                        {wizardStep === 3 && (
                          <div className="space-y-4 text-center py-4">
                            <CheckCircle2 className="h-12 w-12 text-[#96BF48] mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-base font-bold text-white font-sans">Installation complete</h5>
                              <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed font-sans">
                                Connection verified. Ready to index store catalog items.
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full btn-light-primary py-3 text-xs font-bold cursor-pointer"
                            >
                              Index catalog & deploy
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeWizardId === 'int-woo' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-4">
                            <div className="text-center py-2 space-y-1">
                              <Database className="h-10 w-10 text-[#7F54B3] mx-auto" />
                              <h5 className="text-base font-bold text-white font-sans">WooCommerce REST API setup</h5>
                              <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto font-sans">
                                Link your WooCommerce store by entering your API keys.
                              </p>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <label className="font-sans text-xs text-white/60 font-semibold block">Store URL</label>
                                <input
                                  type="text"
                                  value={wooUrl}
                                  onChange={(e) => setWooUrl(e.target.value)}
                                  className="w-full zone-b-input p-2.5 text-xs outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="font-sans text-xs text-white/60 font-semibold block">Consumer key</label>
                                <input
                                  type="password"
                                  value={wooConsumerKey}
                                  onChange={(e) => setWooConsumerKey(e.target.value)}
                                  className="w-full zone-b-input p-2.5 text-xs outline-none"
                                />
                              </div>
                            </div>
                            <button 
                              onClick={() => setWizardStep(2)}
                              className="w-full btn-accent py-3 text-xs font-bold cursor-pointer"
                            >
                              Verify authorization key
                            </button>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4 text-center py-4">
                            <ShieldCheck className="h-12 w-12 text-[#7F54B3] mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-base font-bold text-white font-sans">Credentials verified</h5>
                              <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed font-sans">
                                REST endpoints verified. Webhook handlers registered for continuous sync.
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full btn-light-primary py-3 text-xs font-bold cursor-pointer"
                            >
                              Sync WooCommerce catalog
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

      {/* Facebook multi-Page picker */}
      <AnimatePresence>
        {fbPendingToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="zone-b-grey3 border border-white/20 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col text-left"
            >
              <header className="p-5 border-b border-white/[0.07] bg-black/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#1877F2]/15 border border-[#1877F2]/30 rounded-xl">
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-base text-white">Select a Facebook page</h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      Multiple pages detected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setFbPendingToken(null); setFbPendingPages([]); }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-6 space-y-3">
                <p className="text-xs text-white/60 leading-relaxed font-sans">
                  Choose which Facebook page ShopMate AI should connect to:
                </p>
                {fbPendingPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handleSelectFacebookPage(page.id)}
                    disabled={isSelectingPage}
                    className="w-full p-3.5 text-left border rounded-xl flex justify-between items-center transition-all zone-b-grey2 hover:border-white/30 cursor-pointer disabled:opacity-50"
                  >
                    <span className="text-xs text-white font-sans font-bold">{page.name}</span>
                    <ChevronRight className="h-4 w-4 text-white/40" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp multi-number picker */}
      <AnimatePresence>
        {waPendingToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="zone-b-grey3 border border-white/20 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col text-left"
            >
              <header className="p-5 border-b border-white/[0.07] bg-black/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl">
                    <MessageSquare className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-base text-white">Select a WhatsApp number</h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      Multiple numbers detected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setWaPendingToken(null); setWaPendingNumbers([]); }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-6 space-y-3">
                <p className="text-xs text-white/60 leading-relaxed font-sans">
                  Choose which WhatsApp Business number ShopMate AI should connect to:
                </p>
                {waError && (
                  <div className="status-danger text-xs p-3 rounded-xl font-sans">
                    {waError}
                  </div>
                )}
                {waPendingNumbers.map((num) => (
                  <button
                    key={num.id}
                    onClick={() => handleSelectWhatsAppNumber(num.id)}
                    disabled={isSelectingWa}
                    className="w-full p-3.5 text-left border rounded-xl flex justify-between items-center transition-all zone-b-grey2 hover:border-emerald-500/40 cursor-pointer disabled:opacity-50"
                  >
                    <div>
                      <span className="text-xs text-white font-sans font-bold block">{num.display_phone_number}</span>
                      {num.name && <span className="text-[11px] text-white/50 font-sans">{num.name}</span>}
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
