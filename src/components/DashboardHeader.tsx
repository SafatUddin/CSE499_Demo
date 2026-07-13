import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Settings, LogOut, ChevronDown, MessageSquare, AlertCircle, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { listNotifications, ApiNotification } from '../lib/api';

interface DashboardHeaderProps {
  title: string;
  searchPlaceholder: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function DashboardHeader({
  title,
  searchPlaceholder,
  searchValue = '',
  onSearchChange
}: DashboardHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      listNotifications().then(setNotifications).catch((err) => console.error('Failed to load notifications:', err));
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));

  const handleMarkAllAsRead = () => {
    setDismissedIds(new Set(notifications.map((n) => n.id)));
  };

  const handleMarkAsRead = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const unreadCount = visibleNotifications.length;

  // Profile State synchronized with localStorage
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('shopmate_user_profile');
    return saved ? JSON.parse(saved) : {
      name: "Mara K.",
      email: "merchant@shopmate.ai",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
    };
  });

  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem('shopmate_user_profile');
      if (saved) {
        setProfile(JSON.parse(saved));
      }
    };
    window.addEventListener('shopmate_profile_updated', handleUpdate);
    return () => {
      window.removeEventListener('shopmate_profile_updated', handleUpdate);
    };
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    window.dispatchEvent(new CustomEvent('shopmate_navigate', { detail: 'settings' }));
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    window.dispatchEvent(new CustomEvent('shopmate_logout'));
  };

  return (
    <header className="w-full border-b border-white/[0.06] bg-[#060608]/50 backdrop-blur-md sticky top-0 z-40 select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-3.5 sm:py-5 flex items-center justify-between w-full gap-3">
        {/* Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button 
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('shopmate_toggle_sidebar'))}
            className="md:hidden p-1.5 -ml-1 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-xs sm:text-sm md:text-[22px] font-sans font-extrabold tracking-tight text-white uppercase truncate">
            {title}
          </h1>
        </div>

        {/* Right Side Utility Bar */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Search Bar */}
          <div className="relative w-28 sm:w-48 md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
            <input 
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1 font-sans text-[10px] sm:text-xs text-white placeholder-white/30 focus:border-white/20 transition-all outline-none"
            />
          </div>

          {/* Bell Icon */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 text-white/50 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5 focus:outline-none"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-[#0c0c0e] border border-white/[0.08] rounded-xl shadow-2xl p-1 flex flex-col z-50 overflow-hidden"
                >
                  {/* Notifications Header */}
                  <div className="px-4 py-3 border-b border-white/[0.04] flex justify-between items-center bg-[#070708]/50">
                    <span className="font-sans font-bold text-xs text-white uppercase tracking-wider">Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-[9px] text-white/50 hover:text-white uppercase tracking-wider font-bold transition-colors hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* List Container */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.03] no-scrollbar">
                    {visibleNotifications.length === 0 ? (
                      <div className="p-8 text-center text-white/30 text-xs font-sans">
                        No notifications found.
                      </div>
                    ) : (
                      visibleNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-3 text-left transition-colors cursor-pointer flex gap-2.5 items-start bg-white/[0.02] hover:bg-white/[0.03]"
                        >
                          <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                            n.platform === 'facebook' ? 'bg-[#1877F2]/10 text-[#1877F2]' :
                            n.platform === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-white/10 text-white/70'
                          }`}>
                            {n.type === 'message' ? (
                              <MessageSquare className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                          </div>

                          <div className="flex-grow min-w-0 space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span className="font-sans text-[11px] truncate text-white font-bold">
                                {n.title}
                              </span>
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            </div>
                            <p className="font-sans text-[10px] text-white/40 leading-normal line-clamp-2">
                              {n.body}
                            </p>
                            <p className="text-[8px] text-white/20 font-sans">{formatRelativeTime(n.time)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>



          {/* User Profile Dropdown Component */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-[#18181b] flex items-center justify-center transition-all group-hover:border-white/30">
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-white/40 group-hover:text-white transition-colors" />
            </button>

            {/* Dropdown Options */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 bg-[#0c0c0e] border border-white/[0.08] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5"
                >
                  {/* User info head */}
                  <div className="px-3 py-2 border-b border-white/[0.04] mb-1">
                    <p className="font-sans font-bold text-xs text-white truncate">{profile.name}</p>
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{profile.email}</p>
                  </div>

                  {/* Settings option */}
                  <button
                    onClick={handleSettingsClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-white/70 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
                  >
                    <Settings className="h-4 w-4 text-white/40" />
                    <span className="font-sans text-xs">Merchant Settings</span>
                  </button>

                  {/* Log out option */}
                  <button
                    onClick={handleLogoutClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-white/40 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-white/30" />
                    <span className="font-sans text-xs">Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
