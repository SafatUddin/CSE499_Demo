import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Mail, Lock, LogOut, ArrowLeft } from 'lucide-react';
import DashboardHeader from './DashboardHeader';

interface AdminSettingsProps {
  merchant: { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null } | null;
  onUpdateProfile: (updates: { email?: string; currentPassword?: string; password?: string }) => Promise<void>;
  onLogout: () => void;
}

export default function AdminSettings({ merchant, onUpdateProfile, onLogout }: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'security'>('security');
  const [email, setEmail] = useState(merchant?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleBackToDashboard = () => {
    window.dispatchEvent(new CustomEvent('shopmate_navigate', { detail: 'admin' }));
  };

  const handleSaveEmail = async () => {
    if (!email || email === merchant?.email) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await onUpdateProfile({ email });
      setSuccess('Email updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update email');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    if (!newPassword) {
      setError('New password is required');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSaving(true);

    try {
      await onUpdateProfile({ currentPassword, password: newPassword });
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col text-left bg-[#0a0a0b]">
      <DashboardHeader title="ADMIN SETTINGS" />

      <div className="w-full flex-grow p-6 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back button */}
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 text-white/60 hover:text-white text-[13px] font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-sans font-bold text-[24px] text-white flex items-center gap-3 tracking-tight">
              <Shield className="text-[#00a8e8] h-6 w-6" />
              Admin Settings
            </h1>
            <p className="text-[14px] text-white/60">Manage your admin account security settings</p>
          </div>

          {/* Tabs - Only Security */}
          <div className="flex gap-2 border-b border-white/[0.08]">
            <button
              onClick={() => setActiveTab('security')}
              className={`px-6 py-3 text-[13px] font-medium transition-all border-b-2 ${
                activeTab === 'security'
                  ? 'border-[#00a8e8] text-white'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <Lock className="inline h-4 w-4 mr-2" />
              Security
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-[13px]">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-emerald-400 text-[13px]">
              {success}
            </div>
          )}

          {/* Security Tab Content */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Email Section */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-[#00a8e8]" />
                  <div>
                    <h3 className="font-sans font-bold text-[16px] text-white">Change Email</h3>
                    <p className="text-[12px] text-white/50 mt-0.5">
                      Update your admin email address
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-white/60 mb-2 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-[14px] focus:outline-none focus:border-[#00a8e8] transition-colors"
                      placeholder="admin@example.com"
                    />
                  </div>

                  <button
                    onClick={handleSaveEmail}
                    disabled={isSaving || !email || email === merchant?.email}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#2176ff] via-[#00a8e8] to-[#00d2ff] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold text-[12px] uppercase tracking-wider rounded-lg transition-all"
                  >
                    {isSaving ? 'Updating...' : 'Update Email'}
                  </button>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-[#00a8e8]" />
                  <div>
                    <h3 className="font-sans font-bold text-[16px] text-white">Change Password</h3>
                    <p className="text-[12px] text-white/50 mt-0.5">
                      Use a strong password with at least 8 characters. Changing your password signs out of all other sessions.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-[12px] font-medium text-white/60 mb-2 uppercase tracking-wider">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-[14px] focus:outline-none focus:border-[#00a8e8] transition-colors pr-12"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[12px] font-medium text-white/60 mb-2 uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-[14px] focus:outline-none focus:border-[#00a8e8] transition-colors pr-12"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-[12px] font-medium text-white/60 mb-2 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-[14px] focus:outline-none focus:border-[#00a8e8] transition-colors pr-12"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-white/40 italic">
                    Password must be at least 8 characters. There are no complexity requirements, but a longer passphrase is stronger.
                  </p>

                  <button
                    onClick={handleSavePassword}
                    disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#2176ff] via-[#00a8e8] to-[#00d2ff] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold text-[12px] uppercase tracking-wider rounded-lg transition-all"
                  >
                    {isSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>

              {/* Logout Section */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5 text-red-400" />
                  <div>
                    <h3 className="font-sans font-bold text-[16px] text-white">Sign Out</h3>
                    <p className="text-[12px] text-white/50 mt-0.5">
                      Sign out of your admin session
                    </p>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-sans font-bold text-[12px] uppercase tracking-wider rounded-lg transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
