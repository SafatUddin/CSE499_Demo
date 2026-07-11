import React, { useState } from 'react';
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

  // Form states for Wizards
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('+1 (555) 019-2834');
  const [whatsappOtpInput, setWhatsappOtpInput] = useState('');
  const [whatsappOtpError, setWhatsappOtpError] = useState(false);
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
    setWhatsappOtpError(false);
    setWhatsappOtpInput('');
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

  // Filter based on search term
  const filteredIntegrations = integrations.filter(item => 
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
                    {isWhatsApp ? (
                      <span className="inline-flex items-center text-[9px] font-sans font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                        Action Required
                      </span>
                    ) : item.connected ? (
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
                <span className={`font-sans text-xs ${isWhatsApp ? 'text-red-400 font-semibold' : 'text-white/45'}`}>
                  {item.statusText}
                </span>

                <button
                  onClick={() => handleConnectClick(item)}
                  className={`font-sans text-xs font-bold px-3 py-1.5 rounded-lg tracking-wide transition-all active:scale-[0.98] cursor-pointer ${
                    isWhatsApp 
                      ? 'bg-white hover:bg-white/90 text-black' 
                      : 'bg-transparent hover:bg-white/5 border border-white/10 text-white'
                  }`}
                >
                  {isWhatsApp ? 'Connect' : 'Manage'}
                </button>
              </div>

            </div>
          );
        })}

        {/* INTEGRATION INSIGHT Card - always present at the end of the grid layout */}
        <div className="bg-[#0e0e11] border border-white/[0.06] rounded-xl p-6 flex flex-col justify-between h-[250px] relative overflow-hidden group">
          
          <div className="space-y-4">
            {/* Top header with sparkles */}
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-white/70" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/70">
                Integration Insight
              </span>
            </div>
            
            {/* Quote Body text */}
            <p className="text-[13px] text-white/80 italic font-sans leading-relaxed tracking-tight">
              "Connecting TikTok Shop could increase your multi-channel conversion rate by 14.2% based on current inventory trends."
            </p>
          </div>

          {/* Large bottom View Projection button */}
          <button className="w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/90 font-mono text-[10px] font-bold uppercase tracking-widest py-3 rounded-lg transition-all active:scale-[0.98] cursor-pointer">
            View Projection
          </button>
          
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

                    {/* PATH A: FACEBOOK & INSTAGRAM CHANNELS */}
                    {(activeWizardId === 'int-fb' || activeWizardId === 'int-ig') && (
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

                    {/* PATH B: WHATSAPP BUSINESS WEBHOOKS */}
                    {activeWizardId === 'int-wa' && (
                      <div className="space-y-4">
                        {wizardStep === 1 && (
                          <div className="space-y-4">
                            <div className="text-center py-2 space-y-1">
                              <Smartphone className="h-10 w-10 text-white mx-auto" />
                              <h5 className="text-sm font-semibold text-white">Meta Cloud API Embedded Signup</h5>
                              <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                                Provide your business telephone number linked to your Meta WhatsApp Business app account.
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">Business Phone Number</label>
                              <input
                                type="text"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                className="w-full bg-[#050505] border border-white/10 rounded-lg p-3 font-mono text-xs text-white focus:border-white/30 outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => setWizardStep(2)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer"
                            >
                              Send Verification OTP SMS
                            </button>
                          </div>
                        )}

                        {wizardStep === 2 && (
                          <div className="space-y-4">
                            <div className="text-center py-2 space-y-1">
                              <Smartphone className="h-10 w-10 text-white mx-auto animate-bounce" />
                              <h5 className="text-sm font-semibold text-white">SMS Security Challenge</h5>
                              <p className="text-xs text-white/50 leading-relaxed">
                                We sent a simulated verification OTP to <strong className="text-white">{whatsappNumber}</strong>.<br />
                                <span className="font-mono text-white text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-md inline-block mt-2 font-bold">
                                  SIMULATION OTP: 4021
                                </span>
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="font-sans text-[10px] text-white/40 uppercase tracking-widest font-bold">Enter 4-Digit OTP Code</label>
                              <input
                                type="text"
                                placeholder="0000"
                                maxLength={4}
                                value={whatsappOtpInput}
                                onChange={(e) => {
                                  setWhatsappOtpInput(e.target.value);
                                  setWhatsappOtpError(false);
                                }}
                                className="w-full bg-[#050505] border border-white/10 rounded-lg p-3 text-center font-mono text-lg tracking-widest text-white focus:border-white/30 outline-none"
                              />
                              {whatsappOtpError && (
                                <p className="text-red-400 font-mono text-[9px] uppercase tracking-wider font-semibold mt-1">
                                  Invalid code. Enter 4021 to authenticate.
                                </p>
                              )}
                            </div>
                            <button 
                              onClick={() => {
                                if (whatsappOtpInput === '4021') {
                                  setWizardStep(3);
                                } else {
                                  setWhatsappOtpError(true);
                                }
                              }}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer"
                            >
                              Verify Code
                            </button>
                          </div>
                        )}

                        {wizardStep === 3 && (
                          <div className="space-y-4 text-center py-4">
                            <CheckCircle2 className="h-12 w-12 text-white mx-auto" />
                            <div className="space-y-1.5">
                              <h5 className="text-sm font-semibold text-white">WhatsApp Business Connected</h5>
                              <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                                Phone number authorized via secure OAuth challenge. Meta webhook registrations activated for real-time lead ingestion.
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCompleteWizard(activeWizardId)}
                              className="w-full bg-white hover:bg-white/95 text-black font-sans text-xs font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer"
                            >
                              Deploy Chatbot Hub & Complete
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
      </div>
    </div>
  );
}
