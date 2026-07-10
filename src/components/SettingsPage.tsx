import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Lock, 
  Mail, 
  Upload, 
  CheckCircle, 
  Image as ImageIcon, 
  Eye, 
  EyeOff, 
  Save, 
  AlertCircle 
} from 'lucide-react';
import DashboardHeader from './DashboardHeader';

// Beautiful high-quality preset avatars
const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80"
];

interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
}

interface SettingsPageProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: Partial<UserProfile> & { password?: string }) => void;
}

export default function SettingsPage({ userProfile, onUpdateProfile }: SettingsPageProps) {
  // Profile State
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl);
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Status State
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file.');
      return;
    }
    
    // Read image as base64 to store in profile
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
        setErrorMessage('');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Email cannot be empty.');
      return;
    }

    // Password validation logic
    let passwordUpdate = undefined;
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword) {
        setErrorMessage('Please enter your current password to set a new one.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New passwords do not match.');
        return;
      }
      passwordUpdate = newPassword;
    }

    setIsSaving(true);

    // Simulate saving process
    setTimeout(() => {
      onUpdateProfile({
        name,
        email,
        avatarUrl,
        ...(passwordUpdate ? { password: passwordUpdate } : {})
      });
      
      setIsSaving(false);
      setSuccessMessage('Profile settings updated successfully.');
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    }, 1200);
  };

  return (
    <div className="w-full flex-grow flex flex-col text-left">
      {/* Page header */}
      <DashboardHeader 
        title="MERCHANT SETTINGS" 
        searchPlaceholder="Search setting params..." 
      />

      <div className="max-w-[1440px] mx-auto px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10 w-full flex-grow space-y-6 pb-16">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: User Info & Avatar Selection (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Avatar Profile Box */}
          <div className="bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 text-left space-y-5">
            <h3 className="font-sans font-bold text-sm text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Profile Picture
            </h3>

            {/* Current Avatar preview & upload area */}
            <div className="flex flex-col items-center py-4 space-y-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-2 border-white/20 overflow-hidden bg-[#18181b] flex items-center justify-center">
                  <img 
                    src={avatarUrl} 
                    alt="Current Avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                >
                  <Upload className="h-5 w-5 text-white" />
                </button>
              </div>
              <div className="text-center">
                <h4 className="font-sans font-bold text-xs text-white">{name || "Merchant User"}</h4>
                <p className="text-[10px] text-white/40 mt-1">{email || "merchant@shopmate.ai"}</p>
              </div>
            </div>

            {/* Drag and Drop box */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-white bg-white/5' 
                  : 'border-white/10 hover:border-white/20 bg-[#121215]/30'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
              <Upload className="h-5 w-5 text-white/40 mx-auto mb-2" />
              <p className="font-sans font-bold text-[10px] text-white/80 uppercase tracking-wider">Drag & Drop Image</p>
              <p className="text-[9px] text-white/40 mt-0.5">or click to browse local files</p>
            </div>

            {/* Direct Avatar Image URL input */}
            <div className="space-y-1.5">
              <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                Image URL
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  <ImageIcon className="h-3.5 w-3.5 text-white/30" />
                </span>
                <input
                  type="text"
                  placeholder="Paste direct image URL"
                  value={avatarUrl.startsWith('data:') ? 'Custom Base64 Image' : avatarUrl}
                  onChange={(e) => {
                    if (!e.target.value.startsWith('Custom Base64')) {
                      setAvatarUrl(e.target.value);
                    }
                  }}
                  className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                />
              </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                Or select professional presets
              </label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${
                      avatarUrl === url ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Right column: Form Details (7 Columns) */}
        <div className="lg:col-span-7 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-xl p-5 text-left space-y-6">
          <h3 className="font-sans font-bold text-sm text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
            Profile Credentials
          </h3>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Notifications panel for error / success */}
            <AnimatePresence mode="wait">
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg flex items-center gap-2 text-emerald-400 font-sans text-xs"
                >
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </motion.div>
              )}

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg flex items-center gap-2 text-red-400 font-sans text-xs"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* General Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                  Merchant Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <User className="h-3.5 w-3.5 text-white/30" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mara K."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                  Corporate Email
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Mail className="h-3.5 w-3.5 text-white/30" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="merchant@shopmate.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Password Fields container */}
            <div className="border-t border-white/[0.04] pt-5 space-y-4">
              <div>
                <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">
                  Update Password
                </h4>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Leave fields empty if you do not want to update password
                </p>
              </div>

              <div className="space-y-3.5">
                {/* Current Password */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                    Current Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Lock className="h-3.5 w-3.5 text-white/30" />
                    </span>
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-10 py-2 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                      New Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Lock className="h-3.5 w-3.5 text-white/30" />
                      </span>
                      <input
                        type={showNewPass ? "text" : "password"}
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-10 py-2 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-white/40 uppercase tracking-widest block font-bold">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Lock className="h-3.5 w-3.5 text-white/30" />
                      </span>
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#121215] border border-white/[0.06] rounded-lg pl-9 pr-10 py-2 font-sans text-xs text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer"
                      >
                        {showConfirmPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-4 border-t border-white/[0.04]">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-white/90 text-black rounded-lg font-sans font-bold text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "SAVING PARAMETERS..." : "SAVE SETTINGS PROFILE"}
              </button>
            </div>
          </form>
        </div>

      </div>
      </div>
    </div>
  );
}
