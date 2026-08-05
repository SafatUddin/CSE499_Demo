import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Settings, LogOut, ChevronDown, MessageSquare, AlertCircle, Menu, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { listNotifications, ApiNotification } from '../lib/api';

interface DashboardHeaderProps {
  title?: string;
  searchPlaceholder: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
    <header className="w-full zone-a-topbar z-40 select-none px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between shrink-0">
      {/* Left side: Mobile menu toggle */}
      <div className="flex items-center gap-3">
        <button 
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('shopmate_toggle_sidebar'))}
          className="md:hidden p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right Side Utility Cluster (§5.2) */}
      <div className="flex items-center gap-3.5 shrink-0 ml-auto">
        {/* Search Bar: 300px sunken navy gradient */}
        <div className="relative w-48 sm:w-64 md:w-[320px] search-bar-gradient rounded-xl flex items-center p-1 pl-3.5">
          <Search className="h-4 w-4 text-blue-200/50 shrink-0 mr-2" />
          <input 
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full bg-transparent border-none text-[13px] text-white placeholder-blue-200/40 focus:outline-none font-sans"
          />
          <button className="w-7 h-7 bg-[#2757d8] hover:bg-[#2d5de2] rounded-lg flex items-center justify-center shrink-0 ml-1.5 text-white shadow-md transition-colors cursor-pointer">
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Notification Bell: 38px glass button */}
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-[38px] h-[38px] btn-glass flex items-center justify-center relative focus:outline-none cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-4.5 w-4.5 text-white/80" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full bg-[#4d8bff] shadow-[0_0_8px_rgba(77,139,255,0.9)] animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 zone-b-grey3 p-1 flex flex-col z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/[0.07] flex justify-between items-center bg-black/40">
                  <span className="font-sans font-bold text-xs text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllAsRead}
                      className="text-[10.5px] text-[#7aa8ff] hover:text-[#a9c6ff] font-medium transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.05] no-scrollbar">
                  {visibleNotifications.length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-xs font-sans">
                      No new notifications.
                    </div>
                  ) : (
                    visibleNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id)}
                        className="p-3 text-left transition-colors cursor-pointer flex gap-2.5 items-start hover:bg-white/[0.04]"
                      >
                        <div className="p-1.5 rounded-lg bg-white/10 text-white/80 shrink-0 mt-0.5">
                          {n.type === 'message' ? (
                            <MessageSquare className="h-3.5 w-3.5" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="flex-grow min-w-0 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="font-sans text-[12px] truncate text-white font-semibold">
                              {n.title}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4d8bff] shrink-0 ml-2" />
                          </div>
                          <p className="font-sans text-[11px] text-white/60 leading-normal line-clamp-2">
                            {n.body}
                          </p>
                          <p className="text-[10px] text-white/40 font-sans">{formatRelativeTime(n.time)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile: Royal Blue Avatar Circle inside Glass Pill */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 btn-glass rounded-[99px] focus:outline-none cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2757d8] to-[#14307c] border border-blue-400/40 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {profile.name ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'M'}
            </div>
            <span className="font-sans text-xs text-white/90 font-medium hidden sm:inline">{profile.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-white/50 group-hover:text-white transition-colors" />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 zone-b-grey3 p-2 flex flex-col gap-1 z-50"
              >
                <div className="px-3 py-2 border-b border-white/[0.07] mb-1">
                  <p className="font-sans font-bold text-xs text-white truncate">{profile.name}</p>
                  <p className="text-[11px] text-white/50 truncate mt-0.5">{profile.email}</p>
                </div>

                <button
                  onClick={handleSettingsClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-white/80 hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-white/50" />
                  <span className="font-sans text-xs">Merchant settings</span>
                </button>

                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-white/50 hover:text-[#ffb4b4] hover:bg-[rgba(255,90,90,0.14)] rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4 text-white/40" />
                  <span className="font-sans text-xs">Log out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
