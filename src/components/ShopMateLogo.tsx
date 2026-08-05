import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function ShopMateLogo({ className = "w-10 h-10", size = 24 }: LogoProps) {
  return (
    <div className={`${className} rounded-2xl bg-gradient-to-b from-[#1b55cf] via-[#103fa6] to-[#07246b] border border-[#3b7bfe]/50 flex items-center justify-center shadow-[0_4px_20px_rgba(27,85,207,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] relative overflow-hidden shrink-0`}>
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-radial from-[#4b89ff]/30 to-transparent pointer-events-none" />

      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="text-white relative z-10"
      >
        {/* Chat speech bubble outline */}
        <path d="M19 11.5a7.5 7.5 0 1 1-5.1-7.1" />
        <path d="M12 19l-3.5 2.5 1-3.5" />
        
        {/* Sparkle star at top right */}
        <path 
          d="M18.5 3.5c.3 1.2 1 1.9 2.2 2.2-1.2.3-1.9 1-2.2 2.2-.3-1.2-1-1.9-2.2-2.2 1.2-.3 1.9-1 2.2-2.2z" 
          fill="currentColor" 
          stroke="none" 
        />
      </svg>
    </div>
  );
}

export default ShopMateLogo;
