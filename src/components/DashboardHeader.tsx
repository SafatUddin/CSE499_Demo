import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Settings, LogOut, ChevronDown, MessageSquare, AlertCircle, CheckCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardHeaderProps {
  title: string;
  searchPlaceholder: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
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

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "New FB Message",
      body: "Joya Khan: 'Is the ocean blue dress in stock?'",
      time: "2 mins ago",
      read: false,
      platform: "facebook"
    },
    {
      id: 2,
      title: "Automated Sale",
      body: "Summer Breeze Maxi ($45) sold to JD via WhatsApp",
      time: "15 mins ago",
      read: false,
      platform: "whatsapp"
    },
    {
      id: 3,
      title: "Inventory Alert",
      body: "Red Velvet Lipstick inventory level is below 5 units",
      time: "1 hour ago",
      read: true,
      platform: "system"
    },
    {
      id: 4,
      title: "Sync Successful",
      body: "Instagram chat connections updated successfully",
      time: "4 hours ago",
      read: true,
      platform: "system"
    }
  ]);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 lg:px-10 py-5 flex items-center justify-between w-full">
        {/* Page Title */}
        <h1 className="text-[22px] font-sans font-extrabold tracking-tight text-white uppercase">
          {title}
        </h1>

        {/* Right Side Utility Bar */}
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input 
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-4 py-1.5 font-sans text-xs text-white placeholder-white/30 focus:border-white/20 transition-all outline-none"
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
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-white/30 text-xs font-sans">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id)}
                          className={`p-3 text-left transition-colors cursor-pointer flex gap-2.5 items-start ${
                            n.read ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-white/[0.02] hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                            n.platform === 'facebook' ? 'bg-[#1877F2]/10 text-[#1877F2]' :
                            n.platform === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-white/10 text-white/70'
                          }`}>
                            {n.platform === 'facebook' || n.platform === 'whatsapp' ? (
                              <MessageSquare className="h-3 w-3" />
                            ) : n.title.includes('Alert') ? (
                              <AlertCircle className="h-3 w-3" />
                            ) : (
                              <CheckCircle className="h-3 w-3" />
                            )}
                          </div>

                          <div className="flex-grow min-w-0 space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span className={`font-sans text-[11px] truncate ${n.read ? 'text-white/60 font-medium' : 'text-white font-bold'}`}>
                                {n.title}
                              </span>
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                            </div>
                            <p className="font-sans text-[10px] text-white/40 leading-normal line-clamp-2">
                              {n.body}
                            </p>
                            <p className="text-[8px] text-white/20 font-sans">{n.time}</p>
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
