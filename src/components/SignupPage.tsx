import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, ArrowRight, Check, CreditCard, Zap } from 'lucide-react';
import { Tab } from '../types';

interface SignupPageProps {
  onNavigate: (tab: Tab) => void;
  onSignupSuccess: () => void;
}

export default function SignupPage({ onNavigate, onSignupSuccess }: SignupPageProps) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSignupSuccess();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e2e2e2] font-sans flex overflow-hidden selection:bg-white/10 selection:text-white relative">
      {/* Left Sidebar branding (40%) */}
      <aside className="hidden lg:flex lg:w-[40%] bg-[#0c0c0e] flex-col justify-between p-12 relative border-r border-white/[0.06]">
        {/* Ambient top light aura */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute -top-1/4 -left-1/4 w-full h-full rounded-full bg-white/[0.015] blur-[120px]" />
        </div>

        <div className="relative z-10 space-y-12">
          {/* Brand Logo Header */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="bg-white p-1 rounded-md w-7 h-7 flex items-center justify-center">
              <img 
                alt="ShopMate AI Logo" 
                className="w-full h-full object-contain brightness-100" 
                src="https://lh3.googleusercontent.com/aida/AP1WRLsqDnUHqD8YbYEO3hl_5z6jH3vc2UW1zof-vONlnGyo7aNt-Q2Kd4DI44kdjHpbfZ-7LSwIFER-EhrfmVNe2xvGUpASXXWqG_u-YPfCbtiRyNKkWK7OB-sxZ2_7nYu72ZmGiZdgoPKacOQjz8KkGM9xdb6MLjav2itPZ5OaLiW3xU3d7VL6Nvq_80Um5aMtFHK73yF0E-zTkxLrXHLRoZ4--oa703HZGsl6MhnrGVrPB9LlVrM8L7UC7oY"
              />
            </div>
            <span className="font-sans font-bold text-md text-white tracking-tight">ShopMate AI</span>
          </div>

          {/* Core pitch */}
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-sans font-bold text-white leading-[1.15] tracking-tight max-w-sm">
              Scale your shop to autonomous infinity
            </h1>

            <ul className="space-y-4 pt-4">
              <li className="flex items-center gap-3.5 group">
                <div className="w-8 h-8 rounded bg-white/[0.04] flex items-center justify-center border border-white/[0.08] group-hover:border-white/20 transition-colors">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-white/70 font-medium">Free 14-day trial</span>
              </li>
              <li className="flex items-center gap-3.5 group">
                <div className="w-8 h-8 rounded bg-white/[0.04] flex items-center justify-center border border-white/[0.08] group-hover:border-white/20 transition-colors">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-white/70 font-medium">No credit card required</span>
              </li>
              <li className="flex items-center gap-3.5 group">
                <div className="w-8 h-8 rounded bg-white/[0.04] flex items-center justify-center border border-white/[0.08] group-hover:border-white/20 transition-colors">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-white/70 font-medium">Connect all channels in 2 minutes</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Engine status block */}
        <div className="relative z-10 pt-12">
          <div className="p-4 bg-[#070708]/90 border border-white/[0.07] rounded-lg max-w-[280px]">
            <p className="font-sans text-[8px] text-white/45 uppercase tracking-[0.18em] mb-1 font-bold">ENGINE STATUS</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-sans text-[9px] uppercase tracking-wider text-white/85 font-semibold">AI Command Node Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Onboarding form (60%) */}
      <main className="w-full lg:w-[60%] bg-[#070708] flex flex-col justify-center items-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[480px]">
          {/* Mobile brand header (shown on small screens) */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-10">
            <div className="bg-white p-1 rounded-md w-8 h-8 flex items-center justify-center mb-2">
              <img 
                alt="ShopMate AI Logo" 
                className="w-full h-full object-contain brightness-100" 
                src="https://lh3.googleusercontent.com/aida/AP1WRLsqDnUHqD8YbYEO3hl_5z6jH3vc2UW1zof-vONlnGyo7aNt-Q2Kd4DI44kdjHpbfZ-7LSwIFER-EhrfmVNe2xvGUpASXXWqG_u-YPfCbtiRyNKkWK7OB-sxZ2_7nYu72ZmGiZdgoPKacOQjz8KkGM9xdb6MLjav2itPZ5OaLiW3xU3d7VL6Nvq_80Um5aMtFHK73yF0E-zTkxLrXHLRoZ4--oa703HZGsl6MhnrGVrPB9LlVrM8L7UC7oY"
              />
            </div>
            <span className="font-sans font-bold text-md text-white tracking-tight">ShopMate AI</span>
          </div>

          {/* Form Header */}
          <header className="text-center lg:text-left mb-8 space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-white tracking-tight">Create your command center</h2>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="text-xs text-white/40">Join 5,000+ elite merchants</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.05] text-[8px] font-bold text-white uppercase tracking-wider font-sans">
                PRO TIER
              </span>
            </div>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-sans text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] block" htmlFor="full-name">
                  Full Name
                </label>
                <input 
                  id="full-name"
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#161618] border border-white/[0.06] rounded px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-sans text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] block" htmlFor="business-name">
                  Business Name
                </label>
                <input 
                  id="business-name"
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-[#161618] border border-white/[0.06] rounded px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* Row 2: Contacts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-sans text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] block" htmlFor="mobile-number">
                  Mobile Number
                </label>
                <input 
                  id="mobile-number"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full bg-[#161618] border border-white/[0.06] rounded px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-sans text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] block" htmlFor="email">
                  Email Address
                </label>
                <input 
                  id="email"
                  type="email"
                  required
                  placeholder="john@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161618] border border-white/[0.06] rounded px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* Row 3: Password */}
            <div className="space-y-1.5 relative">
              <label className="font-sans text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] block" htmlFor="password">
                Password
              </label>
              <input 
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161618] border border-white/[0.06] rounded px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none pr-10"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[32px] text-white/30 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 py-1">
              <input 
                id="terms"
                type="checkbox"
                required
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/[0.08] bg-[#161618] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label className="text-xs text-white/50 leading-tight cursor-pointer select-none" htmlFor="terms">
                I agree to the{' '}
                <a href="#" className="text-white hover:underline transition-all font-semibold">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-white hover:underline transition-all font-semibold">Privacy Policy</a>.
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading || !agreeTerms}
              className="w-full bg-[#ceced2] hover:bg-white text-black py-4 rounded font-bold font-sans text-[11px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>CREATING COMMAND CENTER...</span>
              ) : (
                <>
                  Claim Your AI Sales Agent
                  <ArrowRight className="h-3.5 w-3.5 text-black" />
                </>
              )}
            </button>
          </form>

          {/* Onboarding Footer */}
          <footer className="mt-8 pt-6 border-t border-white/[0.06] text-center space-y-6">
            <p className="text-xs text-white/50 font-sans">
              Already have an account?{' '}
              <button 
                onClick={() => onNavigate('login')}
                className="text-white font-bold hover:underline transition-colors ml-1 cursor-pointer"
              >
                Sign In
              </button>
            </p>

            <div className="flex justify-center gap-6 text-white/30 text-[9px] font-sans uppercase tracking-wider font-bold">
              <span>GDPR Compliant</span>
              <span>AES-256 Encryption</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
