import React from 'react';
import { 
  MessageSquare, 
  Package, 
  BarChart3, 
  Grid, 
  Settings,
  LogOut
} from 'lucide-react';
import { Tab } from '../types';

interface SidebarProps {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, onNavigate, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'inbox', label: 'Unified Inbox', icon: MessageSquare },
    { id: 'catalog', label: 'Product Catalog', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'integrations', label: 'Integrations', icon: Grid },
  ];

  return (
    <aside className="w-64 bg-[#0a0a0c] border-r border-white/[0.06] flex flex-col justify-between h-screen fixed top-0 left-0 z-30 select-none">
      <div className="flex flex-col flex-grow">
        {/* Brand Logo Header */}
        <header className="p-6">
          <span className="font-sans font-bold text-[18px] text-white block leading-tight tracking-tight">ShopMate AI</span>
          <span className="font-sans text-[11px] text-white/50 block mt-0.5 tracking-wide">Elite Sales Command</span>
        </header>

        {/* Navigation Items */}
        <nav className="px-3 py-2 flex-grow space-y-1">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Tab)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                  isActive 
                    ? 'bg-white/[0.08] text-white font-medium' 
                    : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <IconComponent className="h-4 w-4 shrink-0" />
                <span className="font-sans text-xs tracking-normal">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / AI Training & Settings */}
      <div className="p-4 border-t border-white/[0.06] space-y-4">
        {/* AI Training Active Card */}
        <div className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e2e2e2]" />
            <span className="font-sans text-[10px] uppercase tracking-[0.12em] font-bold text-white/80">AI Training Active</span>
          </div>
          <div className="w-full bg-white/[0.08] h-1 rounded-full overflow-hidden">
            <div className="bg-[#e2e2e2] h-full w-[82%]" />
          </div>
        </div>

        {/* Settings & Logout buttons */}
        <div className="space-y-1">
          <button
            onClick={() => onNavigate('settings')}
            className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all duration-150 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white/[0.08] text-white font-medium'
                : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="font-sans text-xs">Settings</span>
          </button>

          <button 
            onClick={onLogout}
            className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150 cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="font-sans text-xs">Log Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
