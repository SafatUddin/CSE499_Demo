import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Sparkles, 
  Facebook, 
  Instagram, 
  MessageSquare, 
  User, 
  ShieldAlert,
  Plus,
  FileText,
  Zap,
  ChevronLeft,
  Trash2,
  Paperclip
} from 'lucide-react';
import { Conversation, ChatMessage, Product } from '../types';
import { sendConversationMessage, approveDraftMessage, createOrderFromConversation, updateConversationCart } from '../lib/api';
import DashboardHeader from './DashboardHeader';

interface InboxConsoleProps {
  conversations: Conversation[];
  products: Product[];
  onUpdateConversation: (chatId: string, updates: Partial<Conversation>) => void;
  onUpdateConversationStatus: (chatId: string, status: 'Active' | 'AI Managed' | 'Closed') => Promise<void>;
}

export default function InboxConsole({
  conversations,
  products,
  onUpdateConversation,
  onUpdateConversationStatus
}: InboxConsoleProps) {
  const [selectedChatId, setSelectedChatId] = useState(conversations[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All conversations');
  const [orderAddress, setOrderAddress] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const getChatDisplayName = (chat: Conversation) => {
    if (!chat) return '';
    if (chat.platform !== 'websocket') return chat.customerName;

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
      const customerReplies = chat.messages.slice(askedIndex + 1).filter(m => m.sender === 'customer');
      if (customerReplies.length > 0) {
        return chat.customerName;
      }
    }

    const num = chat.id.replace(/\D/g, '') || '1';
    return `Unknown #${num}`;
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const activeChat = conversations.find(c => c.id === selectedChatId) || conversations[0];

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, isTyping]);

  useEffect(() => {
    if (activeChat?.detectedAddress && !orderAddress.trim()) {
      setOrderAddress(activeChat.detectedAddress);
    }
  }, [activeChat?.id, activeChat?.detectedAddress]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !activeChat) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSimulatedCustomerChannel = activeChat.platform === 'websocket';

    const optimisticMsg: ChatMessage = {
      id: `m-local-${Date.now()}`,
      sender: isSimulatedCustomerChannel ? 'customer' : 'merchant',
      text: textToSend,
      time: timestamp
    };

    const discardDraftId = editingDraftId;
    setEditingDraftId(null);

    onUpdateConversation(activeChat.id, {
      messages: [...activeChat.messages, optimisticMsg],
      lastMessage: textToSend,
      time: 'Just now'
    });
    setInputText('');

    if (isSimulatedCustomerChannel) {
      setIsTyping(true);
    }

    try {
      const updated = await sendConversationMessage(
        activeChat.id,
        textToSend,
        isSimulatedCustomerChannel ? 'customer' : 'merchant',
        discardDraftId || undefined
      );
      onUpdateConversation(activeChat.id, updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApproveDraft = async (messageId: string) => {
    if (!activeChat) return;
    setApprovingId(messageId);
    try {
      const updated = await approveDraftMessage(activeChat.id, messageId);
      onUpdateConversation(activeChat.id, updated);
    } catch (err) {
      console.error(err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleRemoveCartItem = async (skuToRemove: string) => {
    if (!activeChat || !activeChat.cart) return;
    const updatedCart = activeChat.cart.filter((item) => item.sku !== skuToRemove);
    onUpdateConversation(activeChat.id, { cart: updatedCart });
    try {
      const updated = await updateConversationCart(activeChat.id, updatedCart);
      onUpdateConversation(activeChat.id, updated);
    } catch (err) {
      console.error('Failed to update cart on server:', err);
    }
  };

  const handleGenerateOrder = async () => {
    if (!activeChat) return;
    if (!orderAddress.trim()) {
      setOrderError('Enter a shipping address first.');
      return;
    }
    setOrderError('');
    setIsCreatingOrder(true);
    try {
      await createOrderFromConversation(activeChat.id, { address: orderAddress });
      onUpdateConversation(activeChat.id, { cart: undefined });
      setOrderAddress('');
      setOrderSuccess('Order created successfully.');
      setTimeout(() => setOrderSuccess(''), 3000);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to create order.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleToggleAutomation = () => {
    if (!activeChat) return;
    const newStatus = activeChat.status === 'AI Managed' ? 'Active' : 'AI Managed';
    onUpdateConversationStatus(activeChat.id, newStatus);
  };

  const filteredChats = conversations.filter(chat => {
    const displayName = getChatDisplayName(chat);
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    const f = activeFilter.toLowerCase();
    if (f === 'all conversations') return true;
    if (f === 'unread') return chat.unread;
    if (f === 'complaints') return chat.isComplaint;
    if (f === 'facebook') return chat.platform === 'facebook';
    if (f === 'instagram') return chat.platform === 'instagram';
    if (f === 'whatsapp') return chat.platform === 'whatsapp';
    if (f === 'websocket') return chat.platform === 'websocket';
    if (f === 'unresolved') return chat.status === 'Active';
    if (f === 'resolved') return chat.status === 'Closed';
    return true;
  });

  const getFilterCount = (filterName: string) => {
    const f = filterName.toLowerCase();
    return conversations.filter(chat => {
      if (f === 'all conversations') return true;
      if (f === 'unread') return chat.unread;
      if (f === 'complaints') return chat.isComplaint;
      if (f === 'facebook') return chat.platform === 'facebook';
      if (f === 'instagram') return chat.platform === 'instagram';
      if (f === 'whatsapp') return chat.platform === 'whatsapp';
      if (f === 'websocket') return chat.platform === 'websocket';
      if (f === 'unresolved') return chat.status === 'Active';
      if (f === 'resolved') return chat.status === 'Closed';
      return false;
    }).length;
  };

  const renderPlatformIcon = (platform: string, size = 12) => {
    switch (platform) {
      case 'facebook':
        return <Facebook size={size} className="text-[#1877F2]" />;
      case 'instagram':
        return <Instagram size={size} className="text-[#E1306C]" />;
      case 'whatsapp':
        return <MessageSquare size={size} className="text-[#25D366]" />;
      case 'websocket':
        return <Zap size={size} className="text-[#4d8bff]" />;
      default:
        return <User size={size} className="text-white/40" />;
    }
  };

  const FILTERS = [
    'All conversations', 'Unread', 'Unresolved', 'Resolved', 'Complaints', 
    'Archived', 'Spam', 'Facebook', 'Instagram', 'WhatsApp', 'Websocket'
  ];

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col text-left overflow-hidden">
      <DashboardHeader 
        searchPlaceholder="Search conversations…" 
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="w-full flex-grow flex flex-col min-h-0 space-y-3 p-4 md:p-5 overflow-hidden">

        {/* 99px Filter Tabs Row matching Picture 1 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0 flex-nowrap">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            const count = getFilterCount(f);
            const isRedCount = ['unread', 'complaints', 'spam'].includes(f.toLowerCase());

            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[12px] font-sans font-medium px-4 py-2 rounded-[99px] border shrink-0 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive 
                    ? 'bg-[#183478] border-blue-400/50 text-white font-bold shadow-[0_0_14px_rgba(37,82,198,0.45)]' 
                    : 'bg-white/[0.06] border-white/12 text-white/70 hover:text-white hover:bg-white/12'
                }`}
              >
                <span>{f}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${
                    isRedCount 
                      ? 'bg-gradient-to-r from-[#e53935] to-[#c62828]' 
                      : 'bg-gradient-to-r from-[#2552c6] to-[#14307c]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3-Pane Workspace Container strictly fitting 100vh height */}
        <div className="flex-grow min-h-0 flex gap-4 overflow-hidden w-full">
        
          {/* Pane 1: Left Conversation List */}
          <aside className={`zone-b-grey1 flex flex-col h-full lg:w-[34%] min-w-[290px] w-full overflow-hidden shrink-0 ${mobileView === 'list' ? 'flex' : 'hidden lg:flex'}`}>
            <header className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <h3 className="font-sans font-bold text-[16px] text-white">
                Conversations
              </h3>
              <span className="bg-white/10 border border-white/15 rounded-lg px-2.5 py-0.5 text-[11px] font-bold text-white/80 font-mono">
                {filteredChats.length}
              </span>
            </header>

            <div className="flex-grow min-h-0 overflow-y-auto divide-y divide-white/[0.05] p-2 space-y-1 no-scrollbar">
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
                    className={`w-full text-left p-3.5 flex gap-3 items-start transition-all cursor-pointer rounded-xl ${
                      isSelected 
                        ? 'bg-[#1a1d26] border border-blue-400/40 text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]' 
                        : 'bg-transparent border border-transparent hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* 40px Avatar with channel badge */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-full bg-[#2a2d36] border border-white/15 flex items-center justify-center font-sans text-white text-[13px] font-bold uppercase">
                        {getChatDisplayName(chat).split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-[#09090b] p-0.5 rounded-full border border-white/20 shadow-md">
                        {renderPlatformIcon(chat.platform, 11)}
                      </div>
                    </div>

                    <div className="flex-grow min-w-0 space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className={`font-sans text-[13.5px] truncate ${chat.unread ? 'font-bold text-white' : 'font-semibold text-white/90'}`}>
                          {getChatDisplayName(chat)}
                        </span>
                        <span className="font-sans text-[10.5px] text-white/40 shrink-0 ml-2">{chat.time}</span>
                      </div>
                      <p className="font-sans text-[12px] text-white/50 truncate leading-snug">
                        {chat.lastMessage}
                      </p>
                      
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className={`inline-block font-sans text-[10.5px] px-2.5 py-0.5 rounded-full font-semibold ${
                          chat.status === 'AI Managed' ? 'status-info' : 'status-neutral'
                        }`}>
                          {chat.status === 'AI Managed' ? 'AI managed' : 'Manual'}
                        </span>
                        {chat.isComplaint && (
                          <span className="inline-block font-sans text-[10.5px] px-2 py-0.5 rounded-full font-semibold status-danger">
                            Complaint
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Pane 2: Middle Message Thread matching Picture 1 */}
          <main className={`zone-b-black flex flex-col h-full min-w-[360px] flex-1 overflow-hidden relative ${mobileView === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
            <header className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/40 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2757d8] to-[#14307c] border border-blue-400/40 text-white font-bold flex items-center justify-center font-sans text-[13px] shadow-md">
                  {activeChat ? getChatDisplayName(activeChat).split(' ').map(n => n[0]).join('') : ''}
                </div>
                <div>
                  <h4 className="font-sans text-[15px] font-bold text-white leading-tight">{activeChat ? getChatDisplayName(activeChat) : ''}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-[#3ddc84] shadow-[0_0_8px_rgba(61,220,132,0.9)] animate-pulse-dot" />
                    <span className="font-sans text-[11.5px] text-white/50">
                      Active via {activeChat?.platform}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileView('info')}
                  className="lg:hidden p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <FileText className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Message Thread Area */}
            <div ref={messagesContainerRef} className="flex-grow min-h-0 overflow-y-auto p-5 space-y-4 no-scrollbar">
              {activeChat?.isComplaint && (
                <div className="status-danger rounded-2xl p-3.5 flex gap-3 text-left">
                  <ShieldAlert className="h-5 w-5 text-[#ff9d92] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-sans text-xs font-bold uppercase tracking-wider">Complaint isolation override</p>
                    <p className="text-[13px] text-white/80 leading-normal mt-0.5">Customer requested human support. Review conversation history below.</p>
                  </div>
                </div>
              )}

              {activeChat?.messages.map((m) => {
                const isCustomer = m.sender === 'customer';
                const isPendingDraft = m.sender === 'ai' && m.pending;
                return (
                  <div key={m.id} className={`flex w-full ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                    {isPendingDraft ? (
                      <div className="zone-b-grey3 p-4 rounded-2xl max-w-[72%] text-left space-y-3 shadow-xl border border-blue-400/40">
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-[11px] font-bold text-[#a9c6ff] tracking-wider flex items-center gap-1.5">
                            ✦ AI draft reply
                          </span>
                          <span className="font-sans text-[10.5px] text-white/50">{m.time}</span>
                        </div>
                        <p className="text-[13.5px] text-white leading-relaxed">{m.text}</p>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.07]">
                          <button
                            onClick={() => handleApproveDraft(m.id)}
                            disabled={approvingId === m.id}
                            className="btn-accent px-4 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                          >
                            {approvingId === m.id ? 'Sending…' : 'Send now'}
                          </button>
                          <button
                            onClick={() => {
                              setInputText(m.text);
                              setEditingDraftId(m.id);
                            }}
                            className="btn-glass px-4 py-1.5 text-xs cursor-pointer"
                          >
                            Edit reply
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Message Bubbles matching Picture 1 */
                      <div className={`flex flex-col ${isCustomer ? 'items-start max-w-[62%]' : 'items-end max-w-[72%]'}`}>
                        <div className={`p-4 font-sans text-[13.5px] leading-relaxed ${
                          isCustomer
                            ? 'bg-[#202228] border border-white/10 text-white rounded-[16px] rounded-bl-[4px]'
                            : 'bg-gradient-to-br from-[#2552c6] to-[#14307c] border border-blue-400/40 text-white rounded-[16px] rounded-br-[4px] shadow-[0_6px_22px_rgba(37,82,198,0.45)]'
                        }`}>
                          {m.sender === 'ai' && (
                            <div className="flex items-center gap-1 mb-1 text-blue-200">
                              <span className="text-[11px]">✦</span>
                              <span className="font-sans text-[10.5px] font-bold tracking-wider">AI</span>
                            </div>
                          )}
                          <p>{m.text}</p>
                        </div>
                        <span className="text-[10.5px] text-white/40 mt-1 px-1">{m.time}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex w-full justify-end">
                  <div className="bg-gradient-to-br from-[#2552c6]/80 to-[#14307c]/80 border border-blue-400/40 max-w-[72%] rounded-[16px] rounded-br-[4px] p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce [animation-delay:0.4s]" />
                      <span className="font-sans text-[11px] text-blue-200 font-bold ml-1">
                        AI formulating response…
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div />
            </div>

            {/* Composer matching Picture 1 */}
            <footer className="p-4 border-t border-white/[0.08] bg-black/40 space-y-3">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputText);
                }}
                className="flex gap-2 bg-[#131418] border border-white/15 rounded-full p-1.5 pl-3 items-center shadow-lg"
              >
                <button 
                  type="button" 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  onClick={() => setInputText("What other sizes are available?")}
                  title="Attach"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
                
                <input
                  type="text"
                  required
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message or use '/' for templates…"
                  className="flex-grow bg-transparent text-[13.5px] text-white placeholder-white/40 focus:outline-none px-2 font-sans"
                />

                <button
                  type="submit"
                  disabled={isTyping || !inputText.trim()}
                  className="w-8 h-8 rounded-full bg-[#2552c6] hover:bg-[#2e5ee6] text-white flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 shadow-md transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>

              {/* Action Chips + AI Copilot Control matching Picture 1 */}
              <div className="flex items-center gap-3 flex-wrap">
                <button 
                  type="button"
                  onClick={() => setInputText("Here is a customized quote for a bulk order of 5 units. We can offer a discounted rate of $1,199.00 per unit.")}
                  className="bg-[#1a1c22] hover:bg-[#22252d] border border-white/15 text-white font-medium text-[11.5px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span className="text-white/60">✦</span> Suggest quote
                </button>
                <button 
                  type="button"
                  onClick={() => setInputText("The SM-99 Carbon L is one of our premium executive units featuring fully customized hardware.")}
                  className="bg-[#1a1c22] hover:bg-[#22252d] border border-white/15 text-white font-medium text-[11.5px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span className="text-white/60">📄</span> Insert SKU
                </button>

                {activeChat?.platform === 'websocket' && (
                  <button 
                    type="button"
                    onClick={() => {
                      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const custMsg = {
                        id: `m-cust-ws-${Date.now()}`,
                        sender: 'customer' as const,
                        text: `Sure! My name is ${activeChat.customerName} and my address is House 21, Road 7, Banani, Dhaka.`,
                        time: timestamp
                      };
                      onUpdateConversation(activeChat.id, {
                        messages: [...activeChat.messages, custMsg],
                        lastMessage: custMsg.text,
                        time: 'Just now'
                      });
                    }}
                    className="bg-[#1a1c22] hover:bg-[#22252d] border border-white/15 text-[#7aa8ff] font-medium text-[11.5px] px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
                  >
                    ⚡ Simulate customer order reply
                  </button>
                )}

                {/* AI Copilot toggle control matching Picture 1 */}
                <div 
                  onClick={handleToggleAutomation}
                  className={`ml-auto flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer select-none transition-all ${
                    activeChat?.status === 'AI Managed'
                      ? 'bg-gradient-to-r from-[#2552c6] to-[#14307c] border border-blue-400/40 text-white shadow-[0_4px_16px_rgba(37,82,198,0.45)]'
                      : 'bg-[#1a1c22] border border-white/15 text-white/70'
                  }`}
                >
                  <span className="font-sans text-[12px] font-bold">
                    AI copilot
                  </span>
                  
                  {/* Track 40x22 & Knob 16px */}
                  <div className="w-[38px] h-[20px] bg-black/60 border border-white/20 rounded-full relative p-[2px] box-sizing-border-box">
                    <div 
                      className={`w-[14px] h-[14px] rounded-full bg-white transition-all duration-200 cubic-bezier(0.4,0,0.2,1) shadow-md ${
                        activeChat?.status === 'AI Managed' ? 'translate-x-[18px]' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </footer>
          </main>

          {/* Pane 3: Right Cart Panel matching Picture 1 */}
          <aside className={`zone-b-grey1 flex flex-col h-full lg:w-[22%] min-w-[240px] overflow-hidden shrink-0 ${mobileView === 'info' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="lg:hidden p-4 border-b border-white/[0.07] flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => setMobileView('chat')}
                className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-sans text-sm font-bold text-white">Back to thread</span>
            </div>
            
            <section className="p-5 space-y-4 flex-grow min-h-0 overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between">
                <h4 className="font-sans text-[13px] font-bold text-white/80">
                  Cart
                </h4>
                {activeChat?.cart && activeChat.cart.length > 0 && (
                  <span className="status-success px-2.5 py-0.5 text-[10.5px] font-bold rounded-full">
                    Active
                  </span>
                )}
              </div>

              {!activeChat?.cart || activeChat.cart.length === 0 ? (
                <div className="bg-[#15161a] p-8 rounded-2xl border border-dashed border-white/12 text-center">
                  <p className="text-[13px] text-white/40 font-sans">No items in cart yet.</p>
                </div>
              ) : (
                <div className="zone-b-grey3 p-4 rounded-2xl space-y-3">
                  {activeChat.cart.map((item) => {
                    const product = products.find((p) => p.sku === item.sku);
                    return (
                      <div key={item.sku} className="flex justify-between items-center text-[13px] font-sans border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0">
                        <div className="flex-grow min-w-0 pr-2">
                          <span className="text-white font-bold block truncate">{product?.name || item.sku}</span>
                          <span className="text-white/50 text-[11.5px]">{item.quantity} × ${(product?.price || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-white font-bold">${((product?.price || 0) * item.quantity).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.sku)}
                            className="text-white/40 hover:text-[#ff9d92] p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-between items-center pt-2 border-t border-white/[0.08] text-sm font-sans font-bold text-white">
                    <span>Total</span>
                    <span>
                      ${activeChat.cart.reduce((sum, item) => sum + (products.find((p) => p.sku === item.sku)?.price || 0) * item.quantity, 0).toFixed(2)}
                    </span>
                  </div>

                  {orderError && (
                    <div className="status-danger text-[11px] p-2.5 rounded-xl text-center font-sans">
                      {orderError}
                    </div>
                  )}
                  {orderSuccess && (
                    <div className="status-success text-[11px] p-2.5 rounded-xl text-center font-sans">
                      {orderSuccess}
                    </div>
                  )}

                  <input
                    type="text"
                    value={orderAddress}
                    onChange={(e) => setOrderAddress(e.target.value)}
                    placeholder="Shipping address…"
                    className="w-full zone-b-input px-3 py-2.5 font-sans text-xs placeholder-white/38 outline-none"
                  />

                  <button
                    onClick={handleGenerateOrder}
                    disabled={isCreatingOrder}
                    className="w-full btn-light-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" /> {isCreatingOrder ? 'Creating…' : 'Generate order'}
                  </button>
                </div>
              )}
            </section>

          </aside>

        </div>
      </div>
    </div>
  );
}
