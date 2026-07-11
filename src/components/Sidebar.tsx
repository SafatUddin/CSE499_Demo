import React from 'react';
import { 
  MessageSquare, 
  Package, 
  BarChart3, 
  Grid, 
  Settings,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Tab } from '../types';

interface SidebarProps {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ 
  activeTab, 
  onNavigate, 
  onLogout, 
  isOpen = false, 
  onClose,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  const menuItems = [
    { id: 'inbox', label: 'Unified Inbox', icon: MessageSquare },
    { id: 'catalog', label: 'Product Catalog', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'integrations', label: 'Integrations', icon: Grid },
  ];

  return (
    <>
      {/* Backdrop overlay on mobile */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-xs z-45 transition-opacity duration-300"
        />
      )}

      <aside className={`bg-[#0a0a0c] border-r border-white/[0.06] flex flex-col justify-between h-screen fixed top-0 left-0 z-50 md:z-30 select-none transition-all duration-300 ease-out ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex flex-col flex-grow">
          {/* Brand Logo Header */}
          <header className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-white/[0.04] relative`}>
            <div className="flex items-center gap-2.5">
              <img 
                className="h-6 w-6 object-contain brightness-100 shrink-0" 
                src="https://lh3.googleusercontent.com/aida/AP1WRLsqDnUHqD8YbYEO3hl_5z6jH3vc2UW1zof-vONlnGyo7aNt-Q2Kd4DI44kdjHpbfZ-7LSwIFER-EhrfmVNe2xvGUpASXXWqG_u-YPfCbtiRyNKkWK7OB-sxZ2_7nYu72ZmGiZdgoPKacOQjz8KkGM9xdb6MLjav2itPZ5OaLiW3xU3d7VL6Nvq_80Um5aMtFHK73yF0E-zTkxLrXHLRoZ4--oa703HZGsl6MhnrGVrPB9LlVrM8L7UC7oY"
                alt="ShopMate Logo"
              />
              {!isCollapsed && (
                <div>
                  <span className="font-sans font-bold text-[15px] text-white block leading-none tracking-tight">ShopMate AI</span>
                  <span className="font-sans text-[10px] text-white/50 block mt-1 tracking-wide leading-none">Elite Sales Command</span>
                </div>
              )}
            </div>
            
            {/* Collapse button when expanded */}
            {!isCollapsed && (
              <button 
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Expand button on the edge when collapsed */}
            {isCollapsed && (
              <button 
                onClick={onToggleCollapse}
                className="hidden md:flex p-1 text-white/50 hover:text-white bg-[#0a0a0c] border border-white/[0.08] rounded-full hover:bg-white/5 cursor-pointer absolute -right-2.5 top-5 z-50 shadow-md"
                title="Expand Sidebar"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            )}

            {/* Close button on mobile */}
            <button 
              onClick={onClose}
              className="md:hidden p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Navigation Items */}
          <nav className={`px-3 py-4 flex-grow space-y-1.5 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as Tab)}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                    isCollapsed 
                      ? `p-3 rounded-lg justify-center ${isActive ? 'bg-white/[0.08] text-white' : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.03]'}`
                      : `w-full text-left px-3 py-2.5 rounded-lg ${isActive ? 'bg-white/[0.08] text-white font-medium' : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.03]'}`
                  }`}
                >
                  <IconComponent className="h-4.5 w-4.5 shrink-0" />
                  {!isCollapsed && <span className="font-sans text-xs tracking-normal">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer / AI Training & Settings */}
        <div className={`p-4 border-t border-white/[0.06] ${isCollapsed ? 'flex flex-col items-center gap-4' : 'space-y-4'}`}>
          {/* AI Training Active Card */}
          {isCollapsed ? (
            <div className="p-1 bg-white/[0.03] border border-white/[0.06] rounded-full" title="AI Training Active (82%)">
              <span className="w-2 h-2 rounded-full bg-[#e2e2e2] block animate-pulse" />
            </div>
          ) : (
            <div className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e2e2e2]" />
                <span className="font-sans text-[10px] uppercase tracking-[0.12em] font-bold text-white/80">AI Training Active</span>
              </div>
              <div className="w-full bg-white/[0.08] h-1 rounded-full overflow-hidden">
                <div className="bg-[#e2e2e2] h-full w-[82%]" />
              </div>
            </div>
          )}

          {/* Settings & Logout buttons */}
          <div className={`space-y-1.5 ${isCollapsed ? 'w-full flex flex-col items-center' : ''}`}>
            <button
              onClick={() => onNavigate('settings')}
              title={isCollapsed ? 'Settings' : undefined}
              className={`flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                isCollapsed 
                  ? `p-3 rounded-lg justify-center ${activeTab === 'settings' ? 'bg-white/[0.08] text-white' : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.03]'}`
                  : `w-full text-left px-3 py-2.5 rounded-lg ${activeTab === 'settings' ? 'bg-white/[0.08] text-white font-medium' : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.03]'}`
              }`}
            >
              <Settings className="h-4.5 w-4.5 shrink-0" />
              {!isCollapsed && <span className="font-sans text-xs">Settings</span>}
            </button>

            <button 
              onClick={onLogout}
              title={isCollapsed ? 'Log Out' : undefined}
              className={`flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                isCollapsed 
                  ? 'p-3 rounded-lg justify-center text-white/40 hover:text-red-400 hover:bg-red-500/5'
                  : 'w-full text-left px-3 py-2.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/5'
              }`}
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              {!isCollapsed && <span className="font-sans text-xs">Log Out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
