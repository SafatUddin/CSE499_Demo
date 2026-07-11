import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  PlayCircle, 
  CheckCircle, 
  Languages, 
  ShoppingCart, 
  LayoutDashboard, 
  Eye, 
  Globe,
  Grid,
  Image,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Tab } from '../types';

interface LandingPageProps {
  onNavigate: (tab: Tab) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [activeLink, setActiveLink] = useState<'product' | 'features' | 'pricing'>('product');
  // We will display all messages in a beautiful static or staggered visual flow to match the exact mockup in the image.
  return (
    <div className="bg-[#070708] text-[#e2e2e2] font-sans min-h-screen flex flex-col overflow-x-hidden selection:bg-white/10 selection:text-white relative">
      {/* Background gradients */}
      <div className="absolute top-[-5%] right-[-5%] w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[-5%] w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Navigation */}
      <header className="fixed top-0 w-full bg-[#070708]/85 backdrop-blur-md border-b border-white/[0.06] z-50">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
            <img 
              className="h-6 w-6 object-contain brightness-100" 
              src="https://lh3.googleusercontent.com/aida/AP1WRLsqDnUHqD8YbYEO3hl_5z6jH3vc2UW1zof-vONlnGyo7aNt-Q2Kd4DI44kdjHpbfZ-7LSwIFER-EhrfmVNe2xvGUpASXXWqG_u-YPfCbtiRyNKkWK7OB-sxZ2_7nYu72ZmGiZdgoPKacOQjz8KkGM9xdb6MLjav2itPZ5OaLiW3xU3d7VL6Nvq_80Um5aMtFHK73yF0E-zTkxLrXHLRoZ4--oa703HZGsl6MhnrGVrPB9LlVrM8L7UC7oY"
              alt="ShopMate AI Logo"
            />
            <span className="font-sans font-bold text-lg text-white tracking-tight">ShopMate AI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-medium text-white/50">
            <a 
              href="#features" 
              onClick={() => setActiveLink('product')}
              className={`${
                activeLink === 'product' 
                  ? 'text-white border-b-2 border-white pb-1 font-semibold' 
                  : 'hover:text-white transition-colors pb-1 border-b-2 border-transparent'
              } tracking-[0.2em] transition-all duration-200`}
            >
              Product
            </a>
            <a 
              href="#suite" 
              onClick={() => setActiveLink('features')}
              className={`${
                activeLink === 'features' 
                  ? 'text-white border-b-2 border-white pb-1 font-semibold' 
                  : 'hover:text-white transition-colors pb-1 border-b-2 border-transparent'
              } tracking-[0.2em] transition-all duration-200`}
            >
              Features
            </a>
            <a 
              href="#giants" 
              onClick={() => setActiveLink('pricing')}
              className={`${
                activeLink === 'pricing' 
                  ? 'text-white border-b-2 border-white pb-1 font-semibold' 
                  : 'hover:text-white transition-colors pb-1 border-b-2 border-transparent'
              } tracking-[0.2em] transition-all duration-200`}
            >
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => onNavigate('login')}
              className="text-white/70 hover:text-white transition-colors text-[11px] uppercase tracking-[0.2em] font-semibold"
            >
              Sign In
            </button>
            <button 
              onClick={() => onNavigate('signup')}
              className="px-4 py-1.5 bg-white text-black text-[11px] uppercase tracking-widest hover:bg-neutral-200 transition-all font-sans font-bold rounded"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="features" className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 pt-36 pb-16 relative w-full flex-grow flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 xl:gap-24 items-center w-full">
          {/* Left Hero content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-block px-3 py-1 bg-white/[0.04] rounded-full border border-white/[0.08]">
              <span className="font-sans text-[8px] sm:text-[9px] font-bold tracking-[0.18em] text-white/80 uppercase">
                NEW: VISUAL RECOGNITION
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-sans font-bold leading-[1.05] text-white tracking-tight">
              Turn Every Message into a<br />
              Sale.
            </h1>

            <p className="text-xs sm:text-sm text-white/50 max-w-lg leading-relaxed font-normal">
              The AI Sales Agent for Facebook, Instagram, and WhatsApp. Multilingual, image-aware, and always active to close deals while you sleep.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <button 
                onClick={() => onNavigate('signup')}
                className="px-6 py-3 bg-white text-black font-semibold text-[11px] uppercase tracking-widest hover:bg-neutral-200 transition-all font-sans rounded"
              >
                Start Your Free Trial
              </button>
              <button 
                onClick={() => onNavigate('login')}
                className="px-6 py-3 border border-white/10 text-white hover:border-white/30 font-semibold text-[11px] uppercase tracking-widest hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2 font-sans rounded"
              >
                <PlayCircle className="h-4 w-4 text-white" />
                Watch Demo
              </button>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <div className="flex -space-x-1.5">
                <div className="w-5 h-5 rounded-full border border-white/10 bg-[#161618] flex items-center justify-center text-[7px] font-bold text-white/70">JD</div>
                <div className="w-5 h-5 rounded-full border border-white/10 bg-[#161618] flex items-center justify-center text-[7px] font-bold text-white/70">AK</div>
                <div className="w-5 h-5 rounded-full border border-white/10 bg-[#161618] flex items-center justify-center text-[7px] font-bold text-white/70">RS</div>
              </div>
              <p className="text-[10px] tracking-[0.08em] text-white/40">
                <span className="text-white font-bold">Over 5,000 Merchants</span> trust ShopMate AI
              </p>
            </div>
          </div>

          {/* Right Live Conversation Simulator */}
          <div className="lg:col-span-5 relative">
            <div className="bg-[#0c0c0e]/95 border border-white/[0.07] p-6 rounded-lg shadow-2xl backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-white/55 font-bold">LIVE CONVERSATION</span>
                </div>
                <div className="flex gap-1.5 text-white/30 text-xs font-bold tracking-widest leading-none">
                  •••
                </div>
              </div>

              {/* Chat Content exactly like the screenshot */}
              <div className="space-y-4 min-h-[340px] flex flex-col justify-end">
                {/* Customer Msg 1 */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded bg-[#1c1c1f] border border-white/[0.05] shrink-0" />
                  <div className="bg-[#161618] border border-white/[0.04] px-3.5 py-2.5 rounded text-xs text-white/90 max-w-[80%] leading-relaxed">
                    "I love this dress! How much is it?"
                  </div>
                </div>

                {/* AI Response 1 */}
                <div className="flex justify-end">
                  <div className="border border-white/10 bg-transparent px-3.5 py-2.5 rounded text-xs text-white/90 max-w-[80%] leading-relaxed">
                    "Hello! That's our Summer Breeze Maxi. It's $45. Would you like to see the size chart?"
                  </div>
                </div>

                {/* Customer Msg 2 */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded bg-[#1c1c1f] border border-white/[0.05] shrink-0" />
                  <div className="bg-[#161618] border border-white/[0.04] px-3.5 py-2.5 rounded text-xs text-white/90 max-w-[80%] space-y-2 leading-relaxed">
                    <div className="w-24 h-20 rounded bg-[#202024] border border-white/[0.05] flex items-center justify-center">
                      <Image className="h-5 w-5 text-white/20" />
                    </div>
                    <div>"Is this available in Blue?"</div>
                  </div>
                </div>

                {/* AI Response 2 with Buy Button */}
                <div className="flex justify-end">
                  <div className="border border-white/10 bg-transparent px-3.5 py-3.5 rounded text-xs text-white/90 max-w-[80%] space-y-3 leading-relaxed">
                    <div>"Yes! We have 4 units left in Ocean Blue. Click below to secure yours!"</div>
                    <button 
                      onClick={() => onNavigate('login')}
                      className="w-full bg-white text-black font-bold py-2 text-center rounded text-[10px] uppercase tracking-widest font-sans cursor-pointer hover:bg-neutral-200 transition-colors"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Backdrop lighting effect */}
            <div className="absolute -top-10 -right-10 w-72 h-72 bg-white/[0.01] blur-[100px] rounded-full -z-10" />
          </div>
        </div>
      </section>

      {/* KPI Stats Bar */}
      <section className="w-full bg-[#0a0a0c] border-y border-white/[0.06] py-12 lg:py-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center space-y-1">
            <div className="text-3xl md:text-4xl font-sans font-bold text-white tracking-tight">98%</div>
            <div className="font-sans text-[9px] text-white/40 uppercase tracking-[0.2em] font-semibold">Inquiry Accuracy</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-3xl md:text-4xl font-sans font-bold text-white tracking-tight">3.2x</div>
            <div className="font-sans text-[9px] text-white/40 uppercase tracking-[0.2em] font-semibold">Sales Conversion</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-3xl md:text-4xl font-sans font-bold text-white tracking-tight">24/7</div>
            <div className="font-sans text-[9px] text-white/40 uppercase tracking-[0.2em] font-semibold">Always Online</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-lg md:text-xl font-sans font-bold text-white tracking-tight pt-1">Bangla & English</div>
            <div className="font-sans text-[9px] text-white/40 uppercase tracking-[0.2em] font-semibold">Language Support</div>
          </div>
        </div>
      </section>

      {/* Bento Feature Grid Section */}
      <section id="suite" className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 py-24 lg:py-32 w-full space-y-16">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-sans font-bold text-white tracking-tight">The Elite Sales Suite</h2>
          <p className="font-sans text-[10px] text-white/40 uppercase tracking-[0.25em]">Engineered for high-volume commerce and precision automation.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Visual Intelligence (8 Cols) */}
          <div className="md:col-span-8 bg-[#0c0c0e] border border-white/[0.06] p-7 rounded-lg flex flex-col justify-between h-[360px] relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="relative z-10 max-w-md space-y-3">
              <Eye className="text-white h-6 w-6" />
              <h3 className="text-xl font-sans font-bold text-white tracking-tight">Visual Intelligence</h3>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-normal">
                Our neural engine identifies products from customer photos in real-time. Stop asking for SKUs; ShopMate knows exactly what they want.
              </p>
            </div>

            <div className="relative z-10 flex gap-3 mt-6">
              <div className="bg-[#121215] px-3 py-1.5 rounded border border-white/[0.05] flex items-center gap-1.5">
                <CheckCircle className="text-white h-3.5 w-3.5" />
                <span className="font-mono text-[9px] text-white/70 uppercase tracking-[0.15em] font-bold">99% RECOGNITION</span>
              </div>
              <div className="bg-[#121215] px-3 py-1.5 rounded border border-white/[0.05] flex items-center gap-1.5">
                <Clock className="text-white h-3.5 w-3.5" />
                <span className="font-mono text-[9px] text-white/70 uppercase tracking-[0.15em] font-bold">0.4S LATENCY</span>
              </div>
            </div>

            {/* Neural connection network visualization graphic */}
            <div 
              className="absolute right-0 bottom-0 w-[45%] h-full opacity-15 group-hover:opacity-30 transition-opacity bg-cover bg-no-repeat bg-right-bottom pointer-events-none"
              style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCFCaEaxbziO70nRktT5RQpZKFj53KtbHIbr1JwbO-bmKyUhsTHNG7tL1Zi6PoBvdq4hypjWuXUCl9NzGjI8DvOac-jXEWPNLRkCyBRtAFc70ZpRP_QZUzTS64Km3G208BlNg6Akacy736HJJzGM51EMfteHdryO5Ve6JZzGsZHrcp4EMMF5N2V95niyGSN_5IN48CgtfDAy0Z8DY4V8ArEEq9wbQ_y5xgcYztxVPN8n8DZOeCBHCte')` }}
            />
          </div>

          {/* Card 2: Always On (4 Cols) */}
          <div className="md:col-span-4 bg-[#0c0c0e] border border-white/[0.06] p-7 rounded-lg flex flex-col justify-between hover:border-white/20 transition-all">
            <div className="space-y-3">
              <Globe className="text-white h-6 w-6" />
              <h3 className="text-xl font-sans font-bold text-white tracking-tight">Always On</h3>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-normal">
                Fluent in English, Bangla, and Banglish. Capture the local market with cultural nuance and perfect local grammar.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 bg-[#121215] border border-white/[0.05] text-[10px] text-white/70 font-sans rounded">English</span>
              <span className="px-2.5 py-1 bg-[#121215] border border-white/[0.05] text-[10px] text-white/70 font-sans rounded">Bangla</span>
              <span className="px-2.5 py-1 bg-[#121215] border border-white/[0.05] text-[10px] text-white/70 font-sans rounded">Banglish</span>
            </div>
          </div>

          {/* Card 3: One-Click Checkout (4 Cols) */}
          <div className="md:col-span-4 bg-[#0c0c0e] border border-white/[0.06] p-7 rounded-lg flex flex-col justify-between hover:border-white/20 transition-all">
            <div className="space-y-3">
              <ShoppingCart className="text-white h-6 w-6" />
              <h3 className="text-xl font-sans font-bold text-white tracking-tight">One-Click Checkout</h3>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-normal">
                Don't lose customers to friction. Generate secure payment links directly within the chat window instantly.
              </p>
            </div>

            <div className="mt-6 space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-sans text-[8px] text-white/40 uppercase tracking-[0.15em] font-bold">ABANDONED CART REDUCTION</span>
                <span className="text-white font-bold">80%</span>
              </div>
              <div className="w-full h-1 bg-[#121215] rounded-full overflow-hidden border border-white/[0.02]">
                <div className="h-full bg-white w-4/5 rounded-full" />
              </div>
            </div>
          </div>

          {/* Card 4: Unified Command (8 Cols) */}
          <div className="md:col-span-8 bg-[#0c0c0e] border border-white/[0.06] p-7 rounded-lg flex flex-col justify-between min-h-[300px] hover:border-white/20 transition-all relative overflow-hidden group">
            <div className="space-y-3">
              <Grid className="text-white h-6 w-6" />
              <h3 className="text-xl font-sans font-bold text-white tracking-tight">Unified Command</h3>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-normal max-w-lg">
                One elite dashboard for Facebook, Instagram, and WhatsApp. Centralize your inventory, customer data, and sales analytics into a single source of truth.
              </p>
            </div>

            {/* Sync channel states - all connected */}
            <div className="mt-8 grid grid-cols-3 gap-3 z-10 relative">
              <div className="bg-[#121215] border border-white/[0.05] p-3.5 rounded flex flex-col items-center justify-center gap-1.5 hover:border-white/10 transition-all text-center">
                <span className="font-medium text-[10px] text-white/80">Facebook Page</span>
                <span className="text-[8px] bg-white/[0.05] text-white border border-white/10 px-2 py-0.5 rounded font-sans font-bold tracking-wider">CONNECTED</span>
              </div>
              <div className="bg-[#121215] border border-white/[0.05] p-3.5 rounded flex flex-col items-center justify-center gap-1.5 hover:border-white/10 transition-all text-center">
                <span className="font-medium text-[10px] text-white/80">Instagram Chat</span>
                <span className="text-[8px] bg-white/[0.05] text-white border border-white/10 px-2 py-0.5 rounded font-sans font-bold tracking-wider">CONNECTED</span>
              </div>
              <div className="bg-[#121215] border border-white/[0.05] p-3.5 rounded flex flex-col items-center justify-center gap-1.5 hover:border-white/10 transition-all text-center">
                <span className="font-medium text-[10px] text-white/80">WhatsApp API</span>
                <span className="text-[8px] bg-white/[0.05] text-white border border-white/10 px-2 py-0.5 rounded font-sans font-bold tracking-wider">CONNECTED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Intelligence Report Banner */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 py-12 lg:py-16 w-full">
        <div className="bg-[#0c0c0e] border border-white/[0.07] rounded-lg p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute -right-24 -top-24 w-80 h-80 bg-white/[0.01] blur-[120px] rounded-full pointer-events-none" />
          
          <div className="md:max-w-xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-white/[0.05] border border-white/10 flex items-center justify-center">
                <Sparkles className="text-white h-3 w-3" />
              </div>
              <span className="font-sans text-[9px] text-white/60 uppercase tracking-[0.2em] font-bold">AI INTELLIGENCE REPORT</span>
            </div>
            
            <h2 className="text-2xl font-sans font-bold text-white tracking-tight">Predictive Inventory Management</h2>
            <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-normal">
              ShopMate AI doesn't just talk; it thinks. It analyzes chat trends to predict high-demand items before they go out of stock, giving you a competitive edge.
            </p>
          </div>

          <button 
            onClick={() => onNavigate('login')}
            className="px-6 py-3 bg-white text-black font-semibold text-[11px] uppercase tracking-widest font-sans hover:bg-neutral-200 transition-all rounded shrink-0"
          >
            Explore Insights
          </button>
        </div>
      </section>

      {/* Social Proof Corporate Names */}
      <section id="giants" className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 py-16 lg:py-24 border-t border-white/[0.06] text-center space-y-6">
        <p className="font-sans text-[9px] text-white/40 uppercase tracking-[0.25em] font-bold">Powering Local Retail Giants</p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6 opacity-40 hover:opacity-60 transition-all duration-300">
          <span className="font-sans font-bold text-sm tracking-widest text-white">GLAMOUR BD</span>
          <span className="font-sans font-bold text-sm tracking-widest text-white">TECHNO SHOP</span>
          <span className="font-sans font-bold text-sm tracking-widest text-white">KIDS PLANET</span>
          <span className="font-sans font-bold text-sm tracking-widest text-white">SILK ROAD</span>
          <span className="font-sans font-bold text-sm tracking-widest text-white">URBAN VIBE</span>
        </div>
      </section>

      {/* Ready to scale final CTA */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 py-24 lg:py-32 text-center space-y-6 relative">
        <h2 className="text-4xl sm:text-5xl font-sans font-bold text-white leading-tight tracking-tight">Ready to Scale Your Sales?</h2>
        
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button 
            onClick={() => onNavigate('signup')}
            className="px-8 py-3.5 bg-white text-black font-semibold text-[11px] uppercase tracking-widest font-sans hover:bg-neutral-200 transition-all rounded"
          >
            Get Started for Free
          </button>
          <button 
            onClick={() => onNavigate('support')}
            className="px-8 py-3.5 border border-white/10 text-white hover:border-white/30 font-semibold text-[11px] uppercase tracking-widest hover:bg-white/[0.03] transition-all font-sans rounded"
          >
            Schedule a Consultation
          </button>
        </div>

        <p className="font-sans text-[10px] text-white/40 uppercase tracking-[0.15em] pt-1">No credit card required. 14-day free trial.</p>
      </section>

      {/* Footer */}
      <footer className="w-full bg-[#050506] border-t border-white/[0.06] mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 xl:px-16 py-16 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img 
                className="h-5 w-5 object-contain brightness-100" 
                src="https://lh3.googleusercontent.com/aida/AP1WRLsqDnUHqD8YbYEO3hl_5z6jH3vc2UW1zof-vONlnGyo7aNt-Q2Kd4DI44kdjHpbfZ-7LSwIFER-EhrfmVNe2xvGUpASXXWqG_u-YPfCbtiRyNKkWK7OB-sxZ2_7nYu72ZmGiZdgoPKacOQjz8KkGM9xdb6MLjav2itPZ5OaLiW3xU3d7VL6Nvq_80Um5aMtFHK73yF0E-zTkxLrXHLRoZ4--oa703HZGsl6MhnrGVrPB9LlVrM8L7UC7oY"
                alt="ShopMate AI Logo"
              />
              <span className="font-sans font-bold text-md text-white">ShopMate AI</span>
            </div>
            <p className="text-xs text-white/40 font-normal">Empowering merchants with surgical precision AI.</p>
            <p className="text-[10px] text-white/30 font-sans tracking-wide">© 2024 ShopMate AI. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[9px] text-white/35 uppercase tracking-[0.2em] font-bold">PRODUCT</span>
              <a href="#features" className="text-white/50 hover:text-white transition-colors text-xs">Features</a>
              <a href="#suite" className="text-white/50 hover:text-white transition-colors text-xs">Pricing</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors text-xs">API Documentation</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[9px] text-white/35 uppercase tracking-[0.2em] font-bold">LEGAL</span>
              <a href="#" className="text-white/50 hover:text-white transition-colors text-xs">Privacy Policy</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors text-xs">Terms of Service</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[9px] text-white/35 uppercase tracking-[0.2em] font-bold">SUPPORT</span>
              <a href="#" className="text-white/50 hover:text-white transition-colors text-xs">Contact Support</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors text-xs">Community</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
