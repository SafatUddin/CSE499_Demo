import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Sparkles, 
  Facebook, 
  Instagram, 
  MessageSquare, 
  User, 
  Bot, 
  ShoppingBag, 
  ToggleLeft, 
  ToggleRight,
  ShieldAlert,
  Terminal,
  Plus,
  Coins,
  Check,
  FileText,
  Zap,
  ChevronLeft,
  Info
} from 'lucide-react';
import { Conversation, ChatMessage } from '../types';
import { sendConversationMessage, approveDraftMessage } from '../lib/api';
import DashboardHeader from './DashboardHeader';

interface InboxConsoleProps {
  conversations: Conversation[];
  onUpdateConversation: (chatId: string, updates: Partial<Conversation>) => void;
  onUpdateConversationStatus: (chatId: string, status: 'Active' | 'AI Managed' | 'Closed') => Promise<void>;
}

export default function InboxConsole({
  conversations,
  onUpdateConversation,
  onUpdateConversationStatus
}: InboxConsoleProps) {
  const [selectedChatId, setSelectedChatId] = useState(conversations[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL CONVERSATIONS');
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const getChatDisplayName = (chat: Conversation) => {
    if (!chat) return '';
    if (chat.platform !== 'websocket') return chat.customerName;

    // Check if the conversation has asked and answered name/address
    let askedIndex = -1;
    for (let i = 0; i < chat.messages.length; i++) {
      const msg = chat.messages[i];
      if (msg.sender === 'ai' || msg.sender === 'merchant') {
        const text = msg.text.toLowerCase();
        if ((text.includes('name') && text.includes('address')) || text.includes('confirming your order') || text.includes('confirm your order')) {
          askedIndex = i;
          break;
        }
      }
    }

    if (askedIndex !== -1) {
      // Find customer response after the question
      const customerReplies = chat.messages.slice(askedIndex + 1).filter(m => m.sender === 'customer');
      if (customerReplies.length > 0) {
        return chat.customerName; // Revealed name
      }
    }

    // Otherwise, use the number from ID
    const num = chat.id.replace(/\D/g, '') || '1';
    return `Unknown#${num}`;
  };

  // Live adapter webhook telemetry logs
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    '[SYSTEM] LazyChat Unified Channel Adapter initialized.',
    '[SYSTEM] Routing active on webhook endpoint: /api/webhooks/v1/...',
    '[ADAPTER] Active listeners connected to Meta Cloud API (Messenger, IG, WhatsApp).'
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const telemetryEndRef = useRef<HTMLDivElement>(null);
  
  const activeChat = conversations.find(c => c.id === selectedChatId) || conversations[0];

  const pushTelemetryLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setTelemetryLogs(prev => [...prev.slice(-15), `[${timestamp}] ${text}`]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !activeChat) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // The 'websocket' channel is the demo/testing widget with no real external customer,
    // so typing here simulates an incoming customer message. Every other channel (Facebook,
    // Instagram, WhatsApp) already has a real customer on the other end — typing here is the
    // merchant's own reply, sent back to that real customer instead of impersonating them.
    const isSimulatedCustomerChannel = activeChat.platform === 'websocket';

    const optimisticMsg: ChatMessage = {
      id: `m-local-${Date.now()}`,
      sender: isSimulatedCustomerChannel ? 'customer' : 'merchant',
      text: textToSend,
      time: timestamp
    };

    if (isSimulatedCustomerChannel) {
      pushTelemetryLog(`[WEBHOOK] Incoming webhook event from ${activeChat.platform.toUpperCase()}`);
      pushTelemetryLog(`[ADAPTER] Normalized payload: "${textToSend.substring(0, 30)}..."`);
    } else {
      pushTelemetryLog(`[MERCHANT] Sending reply via ${activeChat.platform.toUpperCase()}`);
    }

    const discardDraftId = editingDraftId;
    setEditingDraftId(null);

    onUpdateConversation(activeChat.id, {
      messages: [...activeChat.messages, optimisticMsg],
      lastMessage: textToSend,
      time: 'Just Now'
    });
    setInputText('');

    if (isSimulatedCustomerChannel) {
      setIsTyping(true);
      pushTelemetryLog(`[AI_GATEWAY] Dispatching payload to LLM...`);
    }

    try {
      // The backend persists the message and, for a simulated customer message, generates
      // a reply too — either auto-sent (Copilot on) or held as a pending draft (Copilot
      // off) — either way it returns the authoritative conversation state.
      const updated = await sendConversationMessage(
        activeChat.id,
        textToSend,
        isSimulatedCustomerChannel ? 'customer' : 'merchant',
        discardDraftId || undefined
      );
      onUpdateConversation(activeChat.id, updated);

      if (isSimulatedCustomerChannel) {
        const last = updated.messages[updated.messages.length - 1];
        pushTelemetryLog(last?.pending ? `[LLM_OUT] Draft ready for approval.` : `[LLM_OUT] Response drafted and sent.`);
      } else {
        pushTelemetryLog(`[MERCHANT] Reply delivered.`);
      }
    } catch (err) {
      console.error(err);
      pushTelemetryLog(`[ERROR] Failed to deliver message to the backend.`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApproveDraft = async (messageId: string) => {
    if (!activeChat) return;
    setApprovingId(messageId);
    pushTelemetryLog(`[AGENT] Approving drafted response for delivery.`);
    try {
      const updated = await approveDraftMessage(activeChat.id, messageId);
      onUpdateConversation(activeChat.id, updated);
      pushTelemetryLog(`[AGENT] Draft delivered to customer.`);
    } catch (err) {
      console.error(err);
      pushTelemetryLog(`[ERROR] Failed to approve draft.`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleToggleAutomation = () => {
    if (!activeChat) return;
    const newStatus = activeChat.status === 'AI Managed' ? 'Active' : 'AI Managed';
    onUpdateConversationStatus(activeChat.id, newStatus);
    pushTelemetryLog(`[SYSTEM] Automation state updated to ${newStatus}`);
  };

  // Filter list of chats
  const filteredChats = conversations.filter(chat => {
    const displayName = getChatDisplayName(chat);
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeFilter === 'ALL CONVERSATIONS') return true;
    if (activeFilter === 'UNREAD') return chat.unread;
    if (activeFilter === 'COMPLAINTS') return chat.isComplaint;
    if (activeFilter === 'FACEBOOK') return chat.platform === 'facebook';
    if (activeFilter === 'INSTAGRAM') return chat.platform === 'instagram';
    if (activeFilter === 'WHATSAPP') return chat.platform === 'whatsapp';
    if (activeFilter === 'WEBSOCKET') return chat.platform === 'websocket';
    if (activeFilter === 'UNRESOLVED') return chat.status === 'Active';
    if (activeFilter === 'RESOLVED') return chat.status === 'Closed';
    return true;
  });

  const renderPlatformIcon = (platform: string, size = 13) => {
    switch (platform) {
      case 'facebook':
        return <Facebook size={size} className="text-[#1877F2]" />;
      case 'instagram':
        return <Instagram size={size} className="text-[#E1306C]" />;
      case 'whatsapp':
        return <MessageSquare size={size} className="text-[#25D366]" />;
      case 'websocket':
        return <Zap size={size} className="text-[#00F2FE]" />;
      default:
        return <User size={size} className="text-white/40" />;
    }
  };

  // Static list of filter options matching screenshot
  const FILTERS = [
    'ALL CONVERSATIONS', 'UNREAD', 'UNRESOLVED', 'RESOLVED', 'COMPLAINTS', 
    'ARCHIVED', 'SPAM', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'WEBSOCKET'
  ];

  return (
    <div className="w-full flex-grow flex flex-col text-left h-full overflow-hidden">
      {/* Page header with search functionality linked */}
      <DashboardHeader 
        title="SHOPMATE MERCHANT" 
        searchPlaceholder="Search conversations..." 
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 lg:py-10 w-full flex-grow flex flex-col min-h-0 space-y-5 pb-10 overflow-hidden">

        {/* Channel Filters Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mt-2 no-scrollbar shrink-0">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[9px] font-sans font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border shrink-0 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#121215] border-white text-white' 
                    : 'bg-transparent border-white/10 text-white/40 hover:text-white hover:border-white/20'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Main Console Box layout */}
        <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl flex-grow flex overflow-hidden min-h-0 w-full">
        
        {/* 1. Left Thread List */}
        <aside className={`border-r border-white/[0.06] flex flex-col h-full bg-[#0a0a0c] lg:w-[28%] w-full lg:flex ${mobileView === 'list' ? 'flex' : 'hidden'}`}>
          <header className="p-4 border-b border-white/[0.05] flex items-center justify-between">
            <h3 className="font-sans font-bold text-xs text-white uppercase tracking-wider">
              Conversations
            </h3>
            <span className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[9px] font-bold text-white font-mono">
              {filteredChats.length}
            </span>
          </header>

          <div className="flex-grow overflow-y-auto divide-y divide-white/[0.03] scrollbar-thin scrollbar-thumb-white/10 scroll-smooth">
            {filteredChats.map((chat) => {
              const isSelected = chat.id === selectedChatId;
              return (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    if (chat.unread) {
                      onUpdateConversation(chat.id, { unread: false });
                    }
                    setMobileView('chat');
                  }}
                  className={`w-full text-left p-4 flex gap-3 items-start transition-all cursor-pointer border-l-2 ${
                    isSelected 
                      ? 'bg-white/[0.03] border-white text-white' 
                      : 'bg-transparent border-transparent hover:bg-white/[0.01] text-white/75'
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-[#18181b] border border-white/10 flex items-center justify-center font-sans text-white text-[11px] font-bold uppercase">
                      {getChatDisplayName(chat).split(' ').map(n => n[0]).join('')}
                    </div>
                    {chat.unread && (
                      <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-[#0a0a0c] shadow-md animate-pulse" />
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-[#0a0a0c] p-0.5 rounded-full border border-white/10">
                      {renderPlatformIcon(chat.platform, 10)}
                    </div>
                  </div>

                  <div className="flex-grow min-w-0 space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-sans text-xs text-white truncate ${chat.unread ? 'font-extrabold' : 'font-bold'}`}>{getChatDisplayName(chat)}</span>
                        {chat.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <span className="font-sans text-[9px] text-white/30">{chat.time}</span>
                    </div>
                    <p className={`font-sans text-[11px] truncate pr-2 leading-tight ${chat.unread ? 'text-white/80 font-semibold' : 'text-white/45'}`}>
                      {chat.lastMessage}
                    </p>
                    
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className={`inline-block font-sans text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                        chat.status === 'AI Managed' 
                          ? 'text-white bg-white/[0.04] border-white/10' 
                          : 'text-white/40 bg-transparent border-white/5'
                      }`}>
                        {chat.status === 'AI Managed' ? 'AI MANAGED' : 'MANUAL'}
                      </span>
                      {chat.isComplaint && (
                        <span className="inline-block font-sans text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border-red-500/20">
                          COMPLAINT
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* 2. Middle Conversation Stream */}
        <main className={`border-r border-white/[0.06] flex flex-col h-full bg-[#0d0d10] relative lg:w-[47%] w-full lg:flex ${mobileView === 'chat' ? 'flex' : 'hidden'}`}>
          <header className="p-4 border-b border-white/[0.05] flex items-center justify-between bg-[#0a0a0c]">
            <div className="flex items-center gap-3">
              {/* Back button on mobile */}
              <button 
                type="button"
                onClick={() => setMobileView('list')}
                className="lg:hidden p-1.5 -ml-1 text-white/50 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer shrink-0"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>

              <div className="w-8 h-8 rounded-full bg-[#18181b] border border-white/10 flex items-center justify-center font-sans text-white text-[11px] font-bold">
                {activeChat ? getChatDisplayName(activeChat).split(' ').map(n => n[0]).join('') : ''}
              </div>
              <div>
                <h4 className="font-sans text-xs font-bold text-white leading-none">{activeChat ? getChatDisplayName(activeChat) : ''}</h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-sans text-[9px] text-white/40 uppercase tracking-wider font-semibold">
                    Active via {activeChat?.platform}
                  </span>
                </div>
              </div>
            </div>

            {/* Utility icons */}
            <div className="flex items-center gap-1.5">
              {/* Mobile Info toggle */}
              <button
                type="button"
                onClick={() => setMobileView('info')}
                className="lg:hidden p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="View Strategy & Logs"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Messages Viewport */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scroll-smooth">
            {activeChat?.isComplaint && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex gap-2 text-left">
                <ShieldAlert className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-sans text-[9px] text-red-400 font-bold uppercase tracking-wider">Complaint Isolation Override</p>
                  <p className="text-[11px] text-white/50 leading-normal mt-0.5">Customer is highly dissatisfied. Review conversation below carefully.</p>
                </div>
              </div>
            )}

            {activeChat?.messages.map((m) => {
              const isCustomer = m.sender === 'customer';
              const isPendingDraft = m.sender === 'ai' && m.pending;
              return (
                <div key={m.id} className={`flex w-full ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                  {isPendingDraft ? (
                    /* AI DRAFT MESSAGE TYPE — awaiting merchant approval, not yet delivered */
                    <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl max-w-[85%] text-left space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[9px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-1">
                          ✨ AI-GENERATED REPLY (DRAFT)
                        </span>
                        <span className="font-sans text-[8px] text-white/30">{m.time}</span>
                      </div>
                      <p className="text-xs text-white leading-relaxed">{m.text}</p>

                      {/* Action trigger buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                        <button
                          onClick={() => handleApproveDraft(m.id)}
                          disabled={approvingId === m.id}
                          className="bg-white hover:bg-white/90 text-black font-sans font-extrabold text-[9px] uppercase tracking-wider px-3 py-1.5 rounded transition-all cursor-pointer disabled:opacity-50"
                        >
                          {approvingId === m.id ? 'Sending...' : 'Send Now'}
                        </button>
                        <button
                          onClick={() => {
                            setInputText(m.text);
                            setEditingDraftId(m.id);
                            pushTelemetryLog(`[WORKSPACE] Copy to input for edit.`);
                          }}
                          className="bg-transparent hover:bg-white/5 text-white/80 border border-white/15 font-sans font-extrabold text-[9px] uppercase tracking-wider px-3 py-1.5 rounded transition-all cursor-pointer"
                        >
                          Edit Reply
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* NORMAL MESSAGE TYPE — customer message, or already-delivered AI/merchant reply */
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 border text-left ${
                      isCustomer
                        ? 'bg-[#121215] border-white/[0.04] text-white font-sans text-xs'
                        : 'bg-white/[0.04] border-white/[0.06] text-white/95 font-sans text-xs'
                    }`}>
                      {m.sender === 'ai' && (
                        <span className="font-sans text-[8px] font-bold text-white/40 uppercase tracking-widest block mb-1">
                          ✨ AI
                        </span>
                      )}
                      <p className="leading-relaxed leading-normal">{m.text}</p>
                      <div className="text-right text-[8px] text-white/30 mt-1 font-sans">
                        {m.time}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex w-full justify-end">
                <div className="bg-white/[0.02] border border-white/[0.05] max-w-[85%] rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0.4s]" />
                    <span className="font-sans text-[9px] text-white/40 uppercase tracking-wider font-bold ml-1">
                      AI is formulating response...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* User Input Interaction Panel */}
          <footer className="p-4 border-t border-white/[0.05] bg-[#0a0a0c] space-y-3.5">
            {/* Input Bar */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="flex gap-2 relative bg-[#121215] border border-white/[0.06] rounded-xl px-3 py-2 items-center"
            >
              <button 
                type="button" 
                className="text-white/40 hover:text-white p-1 rounded transition-colors cursor-pointer"
                onClick={() => setInputText("What other sizes are available?")}
              >
                <Plus className="h-4 w-4" />
              </button>
              
              <input
                type="text"
                required
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message or use '/' for templates..."
                className="flex-grow bg-transparent text-xs text-white placeholder-white/30 focus:outline-none px-1"
              />

              <button
                type="submit"
                disabled={isTyping || !inputText.trim()}
                className="bg-white hover:bg-white/90 text-black font-semibold p-1.5 rounded-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>

            {/* Quick Action Shortcuts */}
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setInputText("Here is a customized quote for a bulk order of 5 units of the SM-99 Professional Series. We can offer a discounted rate of $1,199.00 per unit (totaling $5,995.00).")}
                className="bg-[#121215] hover:bg-white/[0.03] border border-white/[0.06] text-white/50 hover:text-white rounded px-2.5 py-1 text-left font-sans text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                ⚡ SUGGEST QUOTE
              </button>
              <button 
                type="button"
                onClick={() => setInputText("The SM-99 Carbon L is one of our premium executive units featuring fully customized hardware.")}
                className="bg-[#121215] hover:bg-white/[0.03] border border-white/[0.06] text-white/50 hover:text-white rounded px-2.5 py-1 text-left font-sans text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                📋 INSERT SKU
              </button>

              {activeChat?.platform === 'websocket' && (
                <button 
                  type="button"
                  onClick={() => {
                    const hasAsked = activeChat.messages.some(m => {
                      const t = m.text.toLowerCase();
                      return (t.includes('name') && t.includes('address')) || t.includes('confirming your order') || t.includes('confirm your order');
                    });
                    
                    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    if (!hasAsked) {
                      const aiMsg = {
                        id: `m-ai-ws-${Date.now()}`,
                        sender: 'ai' as const,
                        text: "Thanks for choosing ShopMate! To finalize and confirm your order, could you please tell me your full name and delivery address?",
                        time: timestamp
                      };
                      onUpdateConversation(activeChat.id, {
                        messages: [...activeChat.messages, aiMsg],
                        lastMessage: aiMsg.text,
                        time: 'Just Now'
                      });
                      pushTelemetryLog(`[WS_AGENT] Prompted client for delivery info.`);
                    } else {
                      const custMsg = {
                        id: `m-cust-ws-${Date.now()}`,
                        sender: 'customer' as const,
                        text: `Sure! My name is ${activeChat.customerName} and my address is House 21, Road 7, Banani, Dhaka.`,
                        time: timestamp
                      };
                      onUpdateConversation(activeChat.id, {
                        messages: [...activeChat.messages, custMsg],
                        lastMessage: custMsg.text,
                        time: 'Just Now'
                      });
                      pushTelemetryLog(`[WS_CLIENT] Received delivery info. Socket client renamed.`);
                    }
                  }}
                  className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 hover:text-white rounded px-2.5 py-1 text-left font-sans text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer animate-pulse"
                >
                  ⚡ SIMULATE SOCKET EVENT
                </button>
              )}

              {/* Automation toggle */}
              <div className="ml-auto flex items-center gap-2 bg-white/[0.02] border border-white/[0.05] px-2.5 py-1 rounded-lg">
                <span className="font-sans text-[8px] text-white/40 uppercase tracking-widest font-bold">
                  AI Copilot
                </span>
                <button
                  type="button"
                  onClick={handleToggleAutomation}
                  className="text-white hover:text-white transition-all cursor-pointer outline-none"
                >
                  {activeChat?.status === 'AI Managed' ? (
                    <ToggleRight className="h-4.5 w-4.5 text-white" />
                  ) : (
                    <ToggleLeft className="h-4.5 w-4.5 text-white/20" />
                  )}
                </button>
              </div>
            </div>
          </footer>
        </main>

        {/* 3. Right Sidebar */}
        <aside className={`flex flex-col h-full bg-[#0a0a0c] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scroll-smooth lg:w-[25%] w-full lg:flex ${mobileView === 'info' ? 'flex' : 'hidden'}`}>
          {/* Mobile Back to Chat Header */}
          <div className="lg:hidden p-4 border-b border-white/[0.05] flex items-center gap-2 bg-[#0a0a0c] shrink-0">
            <button 
              type="button"
              onClick={() => setMobileView('chat')}
              className="p-1.5 -ml-1 text-white/50 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer shrink-0"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <span className="font-sans text-xs font-bold text-white uppercase tracking-wider">Back to Chat</span>
          </div>
          
          {/* Panel 1: Detected SKU */}
          <section className="p-4 border-b border-white/[0.05] space-y-3.5 shrink-0">
            <div className="flex items-center justify-between">
              <h4 className="font-sans text-[9px] font-extrabold text-white/50 uppercase tracking-widest">
                Detected SKU
              </h4>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-sans font-bold px-1.5 py-0.5 rounded">
                ACTIVE
              </span>
            </div>

            {/* SKU Card */}
            <div className="bg-[#121215] border border-white/[0.06] p-3 rounded-lg space-y-3 max-h-[195px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              <div className="flex gap-3">
                {/* Simulated product photo */}
                <div className="w-12 h-12 rounded-md border border-white/10 overflow-hidden bg-[#18181b] shrink-0">
                  <img 
                    src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80" 
                    alt="SM-99 Pro Series" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h5 className="font-sans text-xs font-bold text-white leading-snug">SM-99 Pro Carbon L</h5>
                  <span className="font-sans text-[8px] text-white/30 uppercase block mt-0.5">PROFESSIONAL SERIES</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-2.5 text-[10px] font-sans">
                <div>
                  <span className="text-white/30 block text-[9px]">Stock Level</span>
                  <span className="text-white font-bold block mt-0.5">42 Units Available</span>
                </div>
                <div>
                  <span className="text-white/30 block text-[9px]">Unit Price</span>
                  <span className="text-white font-bold block mt-0.5">$1,299.00</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  pushTelemetryLog(`[CART] Generated bulk order invoice for 5 units.`);
                  setInputText("Here is the purchase link for the 5 units of SM-99 Professional Series Carbon L: http://checkout.shopmate.ai/invoice/ORD-8402");
                }}
                className="w-full bg-[#e2e2e2] hover:bg-white text-black font-sans font-bold text-[9px] uppercase tracking-wider py-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText className="h-3 w-3" /> Generate Order
              </button>
            </div>
          </section>

          {/* Panel 2: AI Strategy */}
          <section className="p-4 border-b border-white/[0.05] space-y-3 shrink-0">
            <h4 className="font-sans text-[9px] font-extrabold text-white/50 uppercase tracking-widest flex items-center gap-1">
              ✨ AI Strategy
            </h4>
            <div className="bg-[#121215] border border-white/[0.06] p-3 rounded-lg font-sans text-[11px] text-white/70 leading-relaxed space-y-2">
              <p>Customer is inquiring about a bulk purchase of 5 units.</p>
              <p className="text-[#a1a1aa] font-medium">Conversion probability: <span className="text-emerald-400 font-bold">92%</span>.</p>
              <div className="bg-white/[0.02] border-l-2 border-white/20 p-2 text-white/55 text-[10px] rounded-r">
                Recommendation: Offer a 5% bundle discount to close the sales cycle today.
              </div>
            </div>
          </section>

          {/* Webhook logs */}
          <section className="p-4 space-y-3 shrink-0 pb-6">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Terminal className="h-3.5 w-3.5 text-white/40" />
              <h4 className="font-sans text-[9px] font-extrabold text-white/50 uppercase tracking-widest">
                Channel Webhook Telemetry
              </h4>
            </div>

            <div className="bg-[#121215] border border-white/[0.06] rounded p-2.5 font-mono text-[8px] text-[#8e9192] overflow-y-auto space-y-1 h-[110px] scrollbar-thin scrollbar-thumb-white/5">
              {telemetryLogs.map((log, i) => (
                <div key={i} className="leading-snug">
                  <span className="text-white/20 select-none mr-1">&gt;</span>
                  {log}
                </div>
              ))}
              <div ref={telemetryEndRef} />
            </div>
          </section>

        </aside>

      </div>
      </div>
    </div>
  );
}
