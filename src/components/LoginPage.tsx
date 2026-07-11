import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, ArrowRight, Facebook } from 'lucide-react';
import { Tab } from '../types';

interface LoginPageProps {
  onNavigate: (tab: Tab) => void;
  onLoginSuccess: () => void;
  userProfile?: {
    name: string;
    email: string;
    avatarUrl: string;
    password?: string;
  };
  onUpdateProfile?: (updates: any) => void;
}

export default function LoginPage({ onNavigate, onLoginSuccess, userProfile, onUpdateProfile }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'reset_password'>('login');
  
  // Login states
  const [email, setEmail] = useState('merchant@shopmate.ai');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset password states
  const [resetEmail, setResetEmail] = useState('merchant@shopmate.ai');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Smooth login simulation
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 1200);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetEmail) {
      setResetError('Email address is required.');
      return;
    }
    if (newPassword.length < 4) {
      setResetError('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Save credentials to local storage so user profile is updated
      if (onUpdateProfile) {
        onUpdateProfile({
          email: resetEmail,
          password: newPassword
        });
      } else {
        const saved = localStorage.getItem('shopmate_user_profile');
        const profile = saved ? JSON.parse(saved) : {};
        localStorage.setItem('shopmate_user_profile', JSON.stringify({
          ...profile,
          email: resetEmail,
          password: newPassword
        }));
        window.dispatchEvent(new Event('shopmate_profile_updated'));
      }
      
      // Auto-login!
      onLoginSuccess();
    }, 1200);
  };

  return (
    <div className="bg-[#070708] text-[#e2e2e2] font-sans min-h-screen flex flex-col justify-between selection:bg-white/10 selection:text-white relative overflow-x-hidden overflow-y-auto">
      {/* Background soft blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-white/[0.015] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-white/[0.01] rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header spacer */}
      <div />

      {/* Main card section */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] bg-[#0c0c0e]/95 border border-white/[0.07] p-6 sm:p-10 flex flex-col items-center rounded-lg shadow-2xl backdrop-blur-xl"
        >
          {/* Brand Identity */}
          <div className="mb-8 flex flex-col items-center">
            <div 
              className="bg-white p-2.5 rounded-lg w-16 h-16 mb-5 flex items-center justify-center cursor-pointer shadow-md hover:opacity-95 transition-opacity"
              onClick={() => onNavigate('landing')}
            >
              <img 
                alt="ShopMate AI Logo" 
                className="w-full h-full object-contain brightness-100" 
                src="https://lh3.googleusercontent.com/aida/AP1WRLsqDnUHqD8YbYEO3hl_5z6jH3vc2UW1zof-vONlnGyo7aNt-Q2Kd4DI44kdjHpbfZ-7LSwIFER-EhrfmVNe2xvGUpASXXWqG_u-YPfCbtiRyNKkWK7OB-sxZ2_7nYu72ZmGiZdgoPKacOQjz8KkGM9xdb6MLjav2itPZ5OaLiW3xU3d7VL6Nvq_80Um5aMtFHK73yF0E-zTkxLrXHLRoZ4--oa703HZGsl6MhnrGVrPB9LlVrM8L7UC7oY"
              />
            </div>
            
            {mode === 'login' ? (
              <>
                <h1 className="font-sans font-bold text-2xl sm:text-3xl text-white text-center mb-1 tracking-tight">Welcome Back</h1>
                <p className="text-xs text-white/50 text-center max-w-[280px] font-sans">
                  Access your sales automation dashboard
                </p>
              </>
            ) : (
              <>
                <h1 className="font-sans font-bold text-2xl sm:text-3xl text-white text-center mb-1 tracking-tight">Reset Password</h1>
                <p className="text-xs text-white/50 text-center max-w-[280px] font-sans">
                  Choose a new secure password to access your account
                </p>
              </>
            )}
          </div>

          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
              {/* Email Field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[9px] font-bold text-white/55 uppercase tracking-[0.15em]" htmlFor="email">
                  Email Address
                </label>
                <input 
                  id="email"
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161618] border border-white/[0.06] px-3.5 py-2.5 font-sans text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none rounded"
                  placeholder="merchant@shopmate.ai"
                />
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-sans text-[9px] font-bold text-white/55 uppercase tracking-[0.15em]" htmlFor="password">
                    Password
                  </label>
                  <button 
                    type="button"
                    onClick={() => setMode('reset_password')}
                    className="font-sans text-[9px] font-bold text-white/40 uppercase tracking-wider hover:text-white transition-colors cursor-pointer focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                
                <div className="relative">
                  <input 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#161618] border border-white/[0.06] px-3.5 py-2.5 font-sans text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none pr-10 rounded"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[#ceced2] hover:bg-white text-black py-3.5 font-sans text-[11px] uppercase tracking-widest font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded"
              >
                {isLoading ? (
                  <span>SIGNING IN...</span>
                ) : (
                  <>
                    Sign In to Command Center
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Reset Password Form */
            <form onSubmit={handleResetSubmit} className="w-full flex flex-col gap-4">
              {resetError && (
                <div className="bg-[#ea4335]/10 border border-[#ea4335]/20 text-[#ea4335] text-[11px] p-2.5 rounded text-center font-sans">
                  {resetError}
                </div>
              )}

              {/* Email Field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[9px] font-bold text-white/55 uppercase tracking-[0.15em]" htmlFor="resetEmail">
                  Email Address
                </label>
                <input 
                  id="resetEmail"
                  type="email" 
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-[#161618] border border-white/[0.06] px-3.5 py-2.5 font-sans text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none rounded"
                  placeholder="merchant@shopmate.ai"
                />
              </div>

              {/* New Password Field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[9px] font-bold text-white/55 uppercase tracking-[0.15em]" htmlFor="newPassword">
                  New Password
                </label>
                <div className="relative">
                  <input 
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#161618] border border-white/[0.06] px-3.5 py-2.5 font-sans text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none pr-10 rounded"
                    placeholder="Minimum 4 characters"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[9px] font-bold text-white/55 uppercase tracking-[0.15em]" htmlFor="confirmPassword">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input 
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#161618] border border-white/[0.06] px-3.5 py-2.5 font-sans text-xs text-white placeholder-white/20 focus:border-white/20 transition-all outline-none pr-10 rounded"
                    placeholder="Repeat password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Reset Password Action Button */}
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-white hover:bg-neutral-200 text-black py-3.5 font-sans text-[11px] uppercase tracking-widest font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded"
              >
                {isLoading ? (
                  <span>RESETTING...</span>
                ) : (
                  <>
                    Reset Password & Sign In
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>

              <button 
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center font-sans text-[10px] text-white/40 uppercase tracking-widest hover:text-white transition-colors py-2 mt-1 cursor-pointer focus:outline-none"
              >
                Back to Sign In
              </button>
            </form>
          )}
          {/* Card Footer */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] w-full text-center">
            <p className="text-xs text-white/40 font-sans">
              New to ShopMate? 
              <button 
                onClick={() => onNavigate('signup')}
                className="text-white font-bold hover:underline ml-1 font-sans cursor-pointer transition-colors"
              >
                Create an account
              </button>
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer Segment */}
      <footer className="w-full bg-[#050506] border-t border-white/[0.06] relative z-10 py-6">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('landing')}>
            <span className="font-sans font-bold text-xs text-white">ShopMate AI</span>
            <span className="text-white/35 text-[10px] font-sans">© 2024. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-[10px] text-white/40 font-sans">
            <a className="hover:text-white transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-white transition-colors" href="#">Terms of Service</a>
            <a className="hover:text-white transition-colors" href="#">API Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
