import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Play, 
  Clock, 
  Zap, 
  Eye, 
  Check, 
  ChevronRight 
} from 'lucide-react';
import { RemlinLogo } from './RemlinLogo';
import { Tab } from '../types';

interface LandingPageProps {
  onNavigate: (tab: Tab) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [activeLink, setActiveLink] = useState<'product' | 'features' | 'pricing'>('product');

  const heroAvatars = [
    { initials: 'JD', style: 'w-[34px] h-[34px] rounded-full border-2 border-[#0b0b0c] bg-gradient-to-br from-white/30 to-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] flex items-center justify-center text-[11px] font-bold text-white' },
    { initials: 'AK', style: 'w-[34px] h-[34px] -ml-[11px] rounded-full border-2 border-[#0b0b0c] bg-gradient-to-br from-white/30 to-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] flex items-center justify-center text-[11px] font-bold text-white' },
    { initials: 'RS', style: 'w-[34px] h-[34px] -ml-[11px] rounded-full border-2 border-[#0b0b0c] bg-gradient-to-br from-white/30 to-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] flex items-center justify-center text-[11px] font-bold text-white' },
  ];

  const heroChat = [
    { text: '"I love this dress! How much is it?"', me: false },
    { text: '"Hello! That’s our Summer Breeze Maxi. It’s $45. Would you like to see the size chart?"', me: true },
    { text: '"Is this available in Blue?"', me: false },
    { text: '"Yes! We have 4 units left in Ocean Blue. Click below to secure yours!"', me: true }
  ];

  const stats = [
    { value: '98%', label: 'Inquiry accuracy' },
    { value: '3.2x', label: 'Sales conversion' },
    { value: '24/7', label: 'Always online' },
    { value: 'Bangla & English', label: 'Language support' }
  ];

  const channels = [
    { mark: 'f', name: 'Facebook page' },
    { mark: '◎', name: 'Instagram chat' },
    { mark: '✆', name: 'WhatsApp API' }
  ];

  const brands = ['Glamour BD', 'Techno Shop', 'Kids Planet', 'Silk Road', 'Urban Vibe'];
  const brandsLoop = [...brands, ...brands];

  // Generate SVG curve points
  const SAMPLES = 240;
  const pts: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const wave = 0.50 * Math.sin(t * 31 + 0.9) + 0.28 * Math.sin(t * 14.5 + 2.1) + 0.14 * Math.sin(t * 58) + 0.08 * Math.sin(t * 92 + 1.4);
    const val = 140 + 520 * t + 92 * wave * (0.45 + 0.55 * t);
    pts.push([t * 900, 300 - Math.max(0, Math.min(800, val)) / 800 * 300]);
  }

  const smooth = (p: [number, number][]) => {
    let d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i === 0 ? 0 : i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  };

  const demandPath = smooth(pts);
  const demandArea = demandPath + ' L900,300 L0,300 Z';
  const mk = pts[Math.round(SAMPLES * 0.6)];
  const leftPct = (mk[0] / 900 * 100).toFixed(2);
  const topPct = (mk[1] / 300 * 100).toFixed(2);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#050506] text-white font-sans selection:bg-white/10 selection:text-white">
      
      {/* Moving Ambient Glow Field */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px] opacity-55" />
        <div className="absolute -top-[24%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.17)_0%,rgba(255,255,255,0.05)_38%,transparent_68%)] blur-[70px] animate-[driftA_26s_ease-in-out_infinite]" />
        <div className="absolute top-[24%] -right-[14%] w-[52vw] h-[52vw] rounded-full bg-[radial-gradient(circle,rgba(215,225,245,0.12)_0%,rgba(255,255,255,0.03)_42%,transparent_70%)] blur-[80px] animate-[driftB_32s_ease-in-out_infinite]" />
        <div className="absolute -bottom-[26%] left-[18%] w-[48vw] h-[48vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.10)_0%,transparent_66%)] blur-[90px] animate-[driftC_38s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(130%_60%_at_50%_-10%,rgba(255,255,255,0.08)_0%,transparent_58%)]" />
      </div>

      <div className="relative z-10">

        {/* NAVIGATION HEADER */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 lg:gap-8 px-5 lg:px-12 py-4 border-b border-white/[0.07] bg-gradient-to-b from-[#0a0a0b]/70 to-[#060607]/40 backdrop-blur-[26px] backdrop-saturate-[150%]">
          <div className="flex items-center cursor-pointer" onClick={() => onNavigate('landing')}>
            <RemlinLogo className="h-10 w-auto" />
          </div>

          <nav className="flex items-center gap-7 ml-4">
            <a 
              href="#suite" 
              onClick={() => setActiveLink('product')}
              className={`text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${activeLink === 'product' ? 'text-white' : 'text-white/60 hover:text-white'}`}
            >
              Product
            </a>
            <a 
              href="#suite" 
              onClick={() => setActiveLink('features')}
              className={`text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${activeLink === 'features' ? 'text-white' : 'text-white/60 hover:text-white'}`}
            >
              Features
            </a>
            <a 
              href="#cta" 
              onClick={() => setActiveLink('pricing')}
              className={`text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${activeLink === 'pricing' ? 'text-white' : 'text-white/60 hover:text-white'}`}
            >
              Pricing
            </a>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('login')}
              className="text-xs font-semibold tracking-[0.14em] uppercase text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/25 bg-gradient-to-b from-white to-[#cfd3da] shadow-[0_10px_26px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.9)] text-[#08090b] text-[12.5px] font-extrabold cursor-pointer hover:brightness-105 transition-all"
            >
              Sign up
            </button>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center px-5 lg:px-12 pt-14 lg:pt-24 pb-20 max-w-[1440px] mx-auto">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/16 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-[10.5px] font-bold tracking-[0.16em] uppercase text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] animate-pulse-dot" />
              New: visual recognition
            </span>

            <h1 className="mt-6.5 text-4xl sm:text-5xl lg:text-[76px] leading-[1.03] font-extrabold tracking-[-0.04em] text-pretty">
              Turn every message<br />
              into a{' '}
              <span className="bg-gradient-to-r from-[#6f747d] via-white via-52% to-[#7d828b] bg-[length:220%_100%] bg-clip-text text-transparent animate-[shimmer_6s_linear_infinite]">
                sale.
              </span>
            </h1>

            <p className="mt-6 max-w-[560px] text-base leading-[1.65] text-white/60 text-pretty">
              The AI sales agent for Facebook, Instagram, and WhatsApp. Multilingual, image-aware, and always active to close deals while you sleep.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 mt-9.5">
              <button
                onClick={() => onNavigate('signup')}
                className="relative overflow-hidden inline-flex items-center gap-2.5 px-7 py-4 rounded-full border border-white/70 bg-gradient-to-b from-[#2f9dff] via-[#4fb3ff] via-34% to-[#dff4fb] shadow-[0_0_0_4px_rgba(120,180,255,0.16),0_0_36px_rgba(70,160,255,0.55),0_12px_32px_rgba(20,90,200,0.45),inset_0_1px_0_rgba(255,255,255,0.85)] text-white text-[13.5px] font-extrabold tracking-[0.06em] uppercase text-shadow-[0_1px_3px_rgba(10,50,110,0.4)] cursor-pointer hover:brightness-105 transition-all"
              >
                Start your free trial
                <ArrowRight className="w-3.7 h-3.7 stroke-[2.4]" />
                <span className="absolute top-0 bottom-0 w-[34%] bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[sweep_4.4s_ease-in-out_infinite] pointer-events-none" />
              </button>

              <button className="inline-flex items-center gap-2.5 px-6.5 py-4 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-white/85 text-[13.5px] font-bold tracking-[0.06em] uppercase cursor-pointer hover:bg-white/15 hover:text-white transition-all">
                <Play className="w-3.5 h-3.5 fill-current" />
                Watch demo
              </button>
            </div>

            <div className="flex items-center gap-3.5 mt-8.5">
              <div className="flex">
                {heroAvatars.map((a, i) => (
                  <span key={i} className={a.style}>{a.initials}</span>
                ))}
              </div>
              <span className="text-[12.5px] text-white/55">Over 5,000 merchants trust Remlin</span>
            </div>
          </div>

          {/* LIVE CONVERSATION CARD */}
          <div className="relative min-w-0 animate-[floaty_9s_ease-in-out_infinite]">
            <div className="absolute -inset-[14%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-[50px] pointer-events-none" />
            <div className="relative rounded-[26px] border border-white/12 bg-radial-at-tl from-white/10 via-transparent to-transparent bg-gradient-to-br from-[#1a1a1d]/92 via-[#0a0a0b]/95 to-[#030304]/97 shadow-[0_50px_120px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[34px] overflow-hidden">
              <div className="flex items-center gap-2.5 px-5.5 py-4.5 border-b border-white/[0.08]">
                <span className="w-1.75 h-1.75 rounded-full bg-[#3ddc84] shadow-[0_0_10px_rgba(61,220,132,0.9)] animate-pulse-dot" />
                <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-white/70">Live conversation</span>
                <div className="flex-1" />
                <span className="tracking-[0.2em] text-white/40 text-xs">•••</span>
              </div>

              <div className="p-5.5 flex flex-col gap-3.5">
                {heroChat.map((m, i) => (
                  <div key={i} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-4 py-3 rounded-[18px] text-[13.5px] leading-snug text-white ${
                      m.me 
                        ? 'max-w-[82%] border border-white/[0.26] bg-gradient-to-br from-white/20 to-white/5 shadow-[0_16px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] rounded-br-[7px]' 
                        : 'max-w-[70%] border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.02] shadow-[0_12px_30px_rgba(0,0,0,0.5)] rounded-bl-[7px]'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}

                <button 
                  onClick={() => onNavigate('signup')}
                  className="mt-1.5 self-end px-6 py-3 rounded-full border border-white/24 bg-gradient-to-b from-white to-[#cfd3da] shadow-[0_10px_26px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.9)] text-[#08090b] text-[11.5px] font-extrabold tracking-[0.12em] uppercase cursor-pointer hover:brightness-105 transition-all"
                >
                  Buy now
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="max-w-[1440px] mx-auto px-5 lg:px-12 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-[22px] overflow-hidden border border-white/10 bg-white/[0.08] shadow-[0_40px_100px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.14)]">
            {stats.map((s, i) => (
              <div key={i} className="p-8 bg-gradient-to-br from-[#18181b]/92 to-[#070708]/96 backdrop-blur-[26px]">
                <div className="text-3xl lg:text-4xl font-extrabold tracking-[-0.03em] text-white text-shadow-[0_4px_40px_rgba(255,255,255,0.22)]">
                  {s.value}
                </div>
                <div className="mt-2.5 text-[10.5px] font-bold tracking-[0.17em] uppercase text-white/50">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUITE SECTION */}
        <section id="suite" className="max-w-[1440px] mx-auto px-5 lg:px-12 pb-10 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-[-0.035em] text-shadow-[0_4px_50px_rgba(255,255,255,0.24)]">
            The elite sales suite
          </h2>
          <p className="mt-4 max-w-[660px] mx-auto text-[11px] font-bold tracking-[0.19em] uppercase text-white/50 leading-relaxed">
            Engineered for high-volume commerce and precision automation.
          </p>
        </section>

        <section className="max-w-[1440px] mx-auto px-5 lg:px-12 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5.5">
          {/* Always On */}
          <article className="flex flex-col p-7 lg:p-7.5 rounded-[24px] border border-white/11 bg-gradient-to-br from-[#1a1a1d]/90 to-[#060607]/96 shadow-[0_40px_100px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[30px]">
            <span className="w-11.5 h-11.5 rounded-[14px] border border-white/18 bg-gradient-to-br from-white/20 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Clock className="w-5.5 h-5.5 text-white stroke-[1.7]" />
            </span>
            <h3 className="mt-5.5 text-6xl font-bold tracking-[-0.02em] text-white">Always on</h3>
            <p className="mt-2.5 text-[13.5px] leading-[1.65] text-white/60 text-pretty">
              Fluent in English, Bangla, and Banglish. Capture the local market with cultural nuance and perfect local grammar.
            </p>
            <div className="flex-1 min-h-5" />
            <div className="flex flex-wrap gap-2 mt-5.5">
              <span className="inline-flex items-center px-3.5 py-1.75 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] text-[11.5px] font-semibold text-white/80">English</span>
              <span className="inline-flex items-center px-3.5 py-1.75 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] text-[11.5px] font-semibold text-white/80">Bangla</span>
              <span className="inline-flex items-center px-3.5 py-1.75 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] text-[11.5px] font-semibold text-white/80">Banglish</span>
            </div>
          </article>

          {/* One-Click Checkout */}
          <article className="flex flex-col p-7 lg:p-7.5 rounded-[24px] border border-white/11 bg-gradient-to-br from-[#1a1a1d]/90 to-[#060607]/96 shadow-[0_40px_100px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[30px]">
            <span className="w-11.5 h-11.5 rounded-[14px] border border-white/18 bg-gradient-to-br from-white/20 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Zap className="w-5.5 h-5.5 text-white stroke-[1.7]" />
            </span>
            <h3 className="mt-5.5 text-22px font-bold tracking-[-0.02em] text-white">One-click checkout</h3>
            <p className="mt-2.5 text-[13.5px] leading-[1.65] text-white/60 text-pretty">
              Don't lose customers to friction. Generate secure payment links directly within the chat window instantly.
            </p>
            <div className="flex-1 min-h-5" />
            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <span className="text-[10.5px] font-bold tracking-[0.15em] uppercase text-white/50">Abandoned cart reduction</span>
                <span className="text-22px font-extrabold tracking-[-0.02em] text-white">80%</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="w-[80%] h-full rounded-full bg-gradient-to-r from-white/40 to-white shadow-[0_0_16px_rgba(255,255,255,0.6)]" />
              </div>
            </div>
          </article>

          {/* Visual Intelligence */}
          <article className="flex flex-col p-7 lg:p-7.5 rounded-[24px] border border-white/11 bg-gradient-to-br from-[#1a1a1d]/90 to-[#060607]/96 shadow-[0_40px_100px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[30px]">
            <span className="relative w-11.5 h-11.5 rounded-[14px] border border-white/18 bg-gradient-to-br from-white/20 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Eye className="w-5.5 h-5.5 text-white stroke-[1.7]" />
              <span className="absolute -inset-[9px] rounded-[20px] border border-dashed border-white/18 animate-[spinSlow_18s_linear_infinite]" />
            </span>
            <h3 className="mt-5.5 text-22px font-bold tracking-[-0.02em] text-white">Visual intelligence</h3>
            <p className="mt-2.5 text-[13.5px] leading-[1.65] text-white/60 text-pretty">
              Our neural engine identifies products from customer photos in real-time. Stop asking for SKUs; Remlin knows exactly what they want.
            </p>
            <div className="flex-1 min-h-5" />
            <div className="flex gap-2.5 mt-5.5">
              <div className="flex-1 p-3.5 lg:p-4 rounded-[14px] border border-white/10 bg-white/[0.05]">
                <div className="text-xl font-extrabold tracking-[-0.02em] text-white">99%</div>
                <div className="mt-1.25 text-[9.5px] font-bold tracking-[0.15em] uppercase text-white/50">Recognition</div>
              </div>
              <div className="flex-1 p-3.5 lg:p-4 rounded-[14px] border border-white/10 bg-white/[0.05]">
                <div className="text-xl font-extrabold tracking-[-0.02em] text-white">0.4s</div>
                <div className="mt-1.25 text-[9.5px] font-bold tracking-[0.15em] uppercase text-white/50">Latency</div>
              </div>
            </div>
          </article>
        </section>

        {/* UNIFIED COMMAND SECTION */}
        <section className="max-w-[1440px] mx-auto px-5 lg:px-12 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          <div className="min-w-0">
            <h2 className="text-3xl lg:text-4.5xl font-extrabold tracking-[-0.035em] leading-tight text-pretty">
              Unified command
            </h2>
            <p className="mt-4.5 max-w-[520px] text-3.75 font-normal leading-relaxed text-white/60 text-pretty">
              One elite dashboard for Facebook, Instagram, and WhatsApp. Centralize your inventory, customer data, and sales analytics into a single source of truth.
            </p>
            <button
              onClick={() => onNavigate('login')}
              className="inline-flex items-center gap-2.5 mt-[30px] px-6 py-3.5 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-white text-[12.5px] font-bold tracking-[0.08em] uppercase cursor-pointer hover:bg-white/15 transition-all"
            >
              Open the console
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          </div>

          <div className="flex flex-col gap-3.5 min-w-0">
            {channels.map((c, i) => (
              <div key={i} className="flex items-center gap-4 p-5 rounded-[20px] border border-white/11 bg-gradient-to-br from-[#1a1a1d]/90 to-[#070708]/96 shadow-[0_26px_70px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[26px]">
                <span className="w-10.5 h-10.5 shrink-0 rounded-[13px] border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center text-lg font-bold text-white">
                  {c.mark}
                </span>
                <span className="flex-1 min-w-0 text-base font-semibold text-white">{c.name}</span>
                <span className="inline-flex items-center gap-1.75 px-3 py-1.5 rounded-full border border-[#3ddc84]/42 bg-[#145a37]/32 text-[9.5px] font-extrabold tracking-[0.14em] uppercase text-[#7ff0b0]">
                  <span className="w-1.25 h-1.25 rounded-full bg-[#3ddc84] shadow-[0_0_8px_rgba(61,220,132,0.9)]" />
                  Connected
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* INTELLIGENCE REPORT SECTION */}
        <section className="max-w-[1440px] mx-auto px-5 lg:px-12 pb-24">
          <div className="relative overflow-hidden p-7 lg:p-11 rounded-[26px] border border-white/11 bg-gradient-to-br from-[#18181a]/90 to-black/97 shadow-[0_50px_120px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[30px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 px-3.75 py-2 rounded-full border border-white/16 bg-white/[0.06] text-[10px] font-bold tracking-[0.17em] uppercase text-white/70">
                  <span className="text-white">✦</span>AI intelligence report
                </span>

                <h2 className="mt-5.5 text-2.5xl lg:text-4xl font-extrabold tracking-[-0.03em] leading-tight text-pretty text-white">
                  Predictive inventory management
                </h2>

                <p className="mt-4 text-[14.5px] leading-relaxed text-white/60 text-pretty">
                  Remlin doesn't just talk; it thinks. It analyzes chat trends to predict high-demand items before they go out of stock, giving you a competitive edge.
                </p>

                <button
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center gap-2.5 mt-7 px-6 py-3.5 rounded-full border border-white/24 bg-gradient-to-b from-white to-[#cfd3da] shadow-[0_10px_26px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.9)] text-[#08090b] text-[12.5px] font-extrabold tracking-[0.08em] uppercase cursor-pointer hover:brightness-105 transition-all"
                >
                  Explore insights
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.4]" />
                </button>
              </div>

              {/* Chart SVG */}
              <div className="relative min-w-0">
                <svg viewBox="0 0 900 300" preserveAspectRatio="none" className="w-full h-[300px] block overflow-visible">
                  <line x1="0" y1="0.5" x2="900" y2="0.5" stroke="rgba(255,255,255,0.07)" />
                  <line x1="0" y1="75" x2="900" y2="75" stroke="rgba(255,255,255,0.07)" />
                  <line x1="0" y1="150" x2="900" y2="150" stroke="rgba(255,255,255,0.07)" />
                  <line x1="0" y1="225" x2="900" y2="225" stroke="rgba(255,255,255,0.07)" />
                  <line x1="0" y1="299.5" x2="900" y2="299.5" stroke="rgba(255,255,255,0.25)" />
                  <defs>
                    <linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="landStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b9099" />
                      <stop offset="55%" stopColor="#e9ecf1" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                  </defs>
                  <path d={demandArea} fill="url(#landFill)" stroke="none" />
                  <path d={demandPath} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="blur-md" />
                  <path d={demandPath} fill="none" stroke="url(#landStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>

                <div 
                  className="absolute -translate-x-[18px] -translate-y-[14px] min-w-[230px] p-3 lg:p-3.75 rounded-[14px] border border-white/14 bg-gradient-to-br from-[#1e1e21]/86 to-[#080809]/90 shadow-[0_18px_44px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-[20px] pointer-events-none"
                  style={{ right: `${(100 - Number(leftPct)).toFixed(2)}%`, top: `${topPct}%` }}
                >
                  <div className="text-[10.5px] text-white/55">Predicted demand spike</div>
                  <div className="mt-1.25 text-[13.5px] font-bold text-white">Summer Breeze Maxi · restock 40</div>
                </div>

                <div 
                  className="absolute w-3.25 h-3.25 -mt-[6.5px] -ml-[6.5px] rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.14),0_0_18px_rgba(255,255,255,0.7)] pointer-events-none"
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* LOGOS MARQUEE SECTION */}
        <section id="giants" className="pb-24">
          <div className="text-center text-[10.5px] font-bold tracking-[0.19em] uppercase text-white/45">
            Powering local retail giants
          </div>
          <div className="relative mt-7.5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className="flex w-max gap-19 pr-19 animate-[marquee_28s_linear_infinite]">
              {brandsLoop.map((b, i) => (
                <span key={i} className="text-xl font-bold tracking-[0.06em] text-white/42 whitespace-nowrap">
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section id="cta" className="max-w-[1440px] mx-auto px-5 lg:px-12 pb-24">
          <div className="relative overflow-hidden p-13 lg:p-20 rounded-[30px] border border-white/12 bg-gradient-to-br from-[#1c1c20]/90 to-black/97 shadow-[0_50px_130px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] text-center backdrop-blur-[30px]">
            <div className="absolute -top-[40%] left-1/2 w-[56vw] h-[56vw] -ml-[28vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_62%)] blur-[80px] animate-[driftC_30s_ease-in-out_infinite] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-[-0.04em] text-shadow-[0_4px_60px_rgba(255,255,255,0.3)]">
                Ready to scale your sales?
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-3.5 mt-9">
                <button
                  onClick={() => onNavigate('signup')}
                  className="relative overflow-hidden inline-flex items-center gap-2.5 px-7.5 py-4 rounded-full border border-white/70 bg-gradient-to-b from-[#2f9dff] via-[#4fb3ff] via-34% to-[#dff4fb] shadow-[0_0_0_4px_rgba(120,180,255,0.16),0_0_36px_rgba(70,160,255,0.55),0_12px_32px_rgba(20,90,200,0.45),inset_0_1px_0_rgba(255,255,255,0.85)] text-white text-[13.5px] font-extrabold tracking-[0.06em] uppercase text-shadow-[0_1px_3px_rgba(10,50,110,0.4)] cursor-pointer hover:brightness-105 transition-all"
                >
                  Get started for free
                  <span className="absolute top-0 bottom-0 w-[34%] bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[sweep_4.4s_ease-in-out_infinite] pointer-events-none" />
                </button>
                <button className="px-7 py-4 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-white/85 text-[13.5px] font-bold tracking-[0.06em] uppercase cursor-pointer hover:bg-white/15 hover:text-white transition-all">
                  Schedule a consultation
                </button>
              </div>
              <div className="mt-6.5 text-[10px] font-bold tracking-[0.19em] uppercase text-white/45">
                No credit card required · 14-day free trial
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="relative overflow-hidden border-t border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="relative max-w-[1440px] mx-auto px-5 lg:px-12 pt-18 pb-11 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-11">
            <div className="min-w-0">
              <div className="flex items-center mb-4 cursor-pointer" onClick={() => onNavigate('landing')}>
                <RemlinLogo className="h-9 w-auto" />
              </div>
              <p className="max-w-[300px] text-sm leading-normal font-semibold text-white/88 text-shadow-[0_1px_12px_rgba(0,0,0,0.6)] text-pretty">
                Empowering merchants with surgical precision AI.
              </p>
              <button
                onClick={() => onNavigate('login')}
                className="inline-flex items-center gap-2.25 mt-5.5 px-5 py-3 rounded-full border border-white/16 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-white text-xs font-extrabold tracking-[0.08em] uppercase cursor-pointer hover:bg-white/15 transition-all"
              >
                Open the console
                <ArrowRight className="w-3.25 h-3.25 stroke-[2.3]" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.19em] uppercase text-white/45">Product</div>
              <div className="mt-4.5 flex flex-col gap-3 items-start">
                <a href="#suite" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Features</a>
                <a href="#cta" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Pricing</a>
                <a href="#" className="text-[13.5px] text-white/66 hover:text-white transition-colors">API documentation</a>
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.19em] uppercase text-white/45">Legal</div>
              <div className="mt-4.5 flex flex-col gap-3 items-start">
                <a href="/privacy" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Privacy policy</a>
                <a href="/terms" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Terms of service</a>
                <a href="/data-deletion" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Data deletion</a>
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.19em] uppercase text-white/45">Support</div>
              <div className="mt-4.5 flex flex-col gap-3 items-start">
                <a href="#" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Contact support</a>
                <a href="#" className="text-[13.5px] text-white/66 hover:text-white transition-colors">Community</a>
              </div>
            </div>
          </div>

          <div className="relative max-w-[1440px] mx-auto px-5 lg:px-12 py-6.5 pb-16 flex flex-wrap items-center gap-3.5 border-t border-white/[0.07]">
            <span className="text-xs text-white/55">© 2024 Remlin. All rights reserved.</span>
            <div className="flex-1" />
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase text-white/45 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84] shadow-[0_0_9px_rgba(61,220,132,0.9)] animate-pulse-dot" />
              All systems operational
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
