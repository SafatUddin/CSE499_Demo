import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Lock,
  Building2,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  Globe,
  MapPin,
  Mail,
  ChevronRight,
} from 'lucide-react';
import DashboardHeader from './DashboardHeader';
import type { PublicMerchant, PublicStore } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  merchant: PublicMerchant | null;
  store: PublicStore | null;
  onUpdateProfile: (input: {
    name?: string;
    phone?: string;
    email?: string;
    currentPassword?: string;
    password?: string;
  }) => Promise<void>;
  onUpdateStore: (input: Partial<PublicStore>) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onDeleteAvatar: () => Promise<void>;
}

// ── Feedback banner ───────────────────────────────────────────────────────────

interface FeedbackProps {
  type: 'success' | 'error';
  message: string;
}

function Feedback({ type, message }: FeedbackProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold tracking-wide ${
        type === 'success' ? 'status-success' : 'status-danger'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      )}
      {message}
    </motion.div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="zone-b-grey2 p-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-white/90 tracking-wide">{title}</h3>
          {description && (
            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/[0.06]" />
      {children}
    </div>
  );
}

// ── Form field ────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
      {note && <p className="text-[10px] text-white/30 leading-relaxed">{note}</p>}
    </div>
  );
}

function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
  rightSlot,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="zone-b-input w-full px-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ paddingRight: rightSlot ? '2.8rem' : undefined }}
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveButton({
  loading,
  disabled,
  label = 'Save Changes',
}: {
  loading: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="btn-light-primary px-5 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase flex items-center gap-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
      ) : null}
      {label}
    </button>
  );
}

// ── Avatar section ────────────────────────────────────────────────────────────

function AvatarSection({
  merchant,
  onUploadAvatar,
  onDeleteAvatar,
}: {
  merchant: PublicMerchant | null;
  onUploadAvatar: (file: File) => Promise<void>;
  onDeleteAvatar: () => Promise<void>;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackProps | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Revoke object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const showFeedback = useCallback((fb: FeedbackProps) => {
    setFeedback(fb);
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, []);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        showFeedback({ type: 'error', message: 'Please select an image file.' });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        showFeedback({ type: 'error', message: 'Image must be 2 MB or smaller.' });
        return;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setPreview(objectUrl);
      setPendingFile(file);
    },
    [showFeedback],
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      await onUploadAvatar(pendingFile);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreview(null);
      setPendingFile(null);
      showFeedback({ type: 'success', message: 'Profile picture updated.' });
    } catch (err: any) {
      showFeedback({ type: 'error', message: err?.message || 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!merchant?.avatarUrl && !preview) return;
    if (preview) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreview(null);
      setPendingFile(null);
      return;
    }
    setUploading(true);
    try {
      await onDeleteAvatar();
      showFeedback({ type: 'success', message: 'Profile picture removed.' });
    } catch (err: any) {
      showFeedback({ type: 'error', message: err?.message || 'Failed to remove picture.' });
    } finally {
      setUploading(false);
    }
  };

  const displayAvatar = preview || merchant?.avatarUrl || null;

  return (
    <SectionCard
      title="Profile Picture"
      description="Upload a JPEG, PNG, WebP, or GIF. Max 2 MB."
      icon={<Camera className="w-4 h-4 text-white/50" />}
    >
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* Avatar preview */}
        <div className="shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <User className="w-8 h-8 text-white/20" />
            )}
          </div>
        </div>

        {/* Drop zone */}
        <div className="flex-1 flex flex-col gap-3 w-full">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-5 py-5 text-center cursor-pointer transition-colors duration-150 select-none ${
              dragActive
                ? 'border-blue-400/60 bg-blue-400/10'
                : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <p className="text-[12px] text-white/50 font-medium">
              {pendingFile ? (
                <span className="text-blue-300">{pendingFile.name}</span>
              ) : (
                <>Drag & drop or <span className="text-white/70 underline underline-offset-2">click to browse</span></>
              )}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />

          <AnimatePresence mode="wait">
            {feedback && <Feedback key="fb" type={feedback.type} message={feedback.message} />}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {pendingFile && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="btn-light-primary px-4 py-2 text-[11px] font-bold tracking-[0.08em] uppercase flex items-center gap-1.5 disabled:opacity-50"
              >
                {uploading ? (
                  <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : null}
                Save Picture
              </button>
            )}
            {(displayAvatar) && !uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="btn-glass px-4 py-2 text-[11px] font-bold tracking-[0.08em] uppercase flex items-center gap-1.5 text-red-300 border-red-500/20 hover:border-red-400/40"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Personal information section ──────────────────────────────────────────────

function PersonalInfoSection({
  merchant,
  onUpdateProfile,
}: {
  merchant: PublicMerchant | null;
  onUpdateProfile: SettingsPageProps['onUpdateProfile'];
}) {
  const [name, setName] = useState(merchant?.name || '');
  const [email, setEmail] = useState(merchant?.email || '');
  const [phone, setPhone] = useState(merchant?.phone || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackProps | null>(null);

  // Sync if merchant data changes (e.g. after successful save in another section)
  useEffect(() => {
    setName(merchant?.name || '');
    setEmail(merchant?.email || '');
    setPhone(merchant?.phone || '');
  }, [merchant?.name, merchant?.email, merchant?.phone]);

  const showFeedback = useCallback((fb: FeedbackProps) => {
    setFeedback(fb);
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showFeedback({ type: 'error', message: 'Full name is required.' });
      return;
    }
    setSaving(true);
    try {
      await onUpdateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      showFeedback({ type: 'success', message: 'Personal information saved.' });
    } catch (err: any) {
      showFeedback({ type: 'error', message: err?.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Personal Information"
      description="Your name and contact details visible in the merchant portal."
      icon={<User className="w-4 h-4 text-white/50" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name">
            <Input
              value={name}
              onChange={setName}
              placeholder="Jane Smith"
              disabled={saving}
              autoComplete="name"
            />
          </Field>
          <Field
            label="Email Address"
            note="Email changes take effect immediately. No verification email is sent."
          >
            <Input
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              disabled={saving}
              autoComplete="email"
            />
          </Field>
        </div>
        <Field label="Phone Number">
          <Input
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+1 (555) 000-0000"
            disabled={saving}
            autoComplete="tel"
          />
        </Field>

        <AnimatePresence mode="wait">
          {feedback && <Feedback key="fb" type={feedback.type} message={feedback.message} />}
        </AnimatePresence>

        <SaveButton loading={saving} />
      </form>
    </SectionCard>
  );
}

// ── Business information section ──────────────────────────────────────────────

function BusinessInfoSection({
  store,
  onUpdateStore,
}: {
  store: PublicStore | null;
  onUpdateStore: SettingsPageProps['onUpdateStore'];
}) {
  const [storeName, setStoreName] = useState(store?.name || '');
  const [businessPhone, setBusinessPhone] = useState(store?.businessPhone || '');
  const [website, setWebsite] = useState(store?.website || '');
  const [streetAddress, setStreetAddress] = useState(store?.streetAddress || '');
  const [city, setCity] = useState(store?.city || '');
  const [province, setProvince] = useState(store?.province || '');
  const [postalCode, setPostalCode] = useState(store?.postalCode || '');
  const [country, setCountry] = useState(store?.country || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackProps | null>(null);

  useEffect(() => {
    setStoreName(store?.name || '');
    setBusinessPhone(store?.businessPhone || '');
    setWebsite(store?.website || '');
    setStreetAddress(store?.streetAddress || '');
    setCity(store?.city || '');
    setProvince(store?.province || '');
    setPostalCode(store?.postalCode || '');
    setCountry(store?.country || '');
  }, [
    store?.name,
    store?.businessPhone,
    store?.website,
    store?.streetAddress,
    store?.city,
    store?.province,
    store?.postalCode,
    store?.country,
  ]);

  const showFeedback = useCallback((fb: FeedbackProps) => {
    setFeedback(fb);
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      showFeedback({ type: 'error', message: 'Business name is required.' });
      return;
    }
    if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
      showFeedback({ type: 'error', message: 'Website must be a valid URL starting with https://.' });
      return;
    }
    setSaving(true);
    try {
      await onUpdateStore({
        name: storeName.trim(),
        businessPhone: businessPhone.trim(),
        website: website.trim(),
        streetAddress: streetAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
      });
      showFeedback({ type: 'success', message: 'Business information saved.' });
    } catch (err: any) {
      showFeedback({ type: 'error', message: err?.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Business Information"
      description="Your store's public-facing contact details and address."
      icon={<Building2 className="w-4 h-4 text-white/50" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business / Store Name">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Acme Corp"
                disabled={saving}
                autoComplete="organization"
                className="zone-b-input w-full pl-9 pr-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50"
              />
            </div>
          </Field>
          <Field label="Business Phone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <input
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={saving}
                autoComplete="tel"
                className="zone-b-input w-full pl-9 pr-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50"
              />
            </div>
          </Field>
        </div>

        <Field label="Website">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourstore.com"
              disabled={saving}
              autoComplete="url"
              className="zone-b-input w-full pl-9 pr-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50"
            />
          </div>
        </Field>

        <Field label="Street Address">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="123 Main Street"
              disabled={saving}
              autoComplete="street-address"
              className="zone-b-input w-full pl-9 pr-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50"
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="City">
            <Input
              value={city}
              onChange={setCity}
              placeholder="New York"
              disabled={saving}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="Province / State">
            <Input
              value={province}
              onChange={setProvince}
              placeholder="NY"
              disabled={saving}
              autoComplete="address-level1"
            />
          </Field>
          <Field label="Postal / ZIP Code">
            <Input
              value={postalCode}
              onChange={setPostalCode}
              placeholder="10001"
              disabled={saving}
              autoComplete="postal-code"
            />
          </Field>
        </div>

        <Field label="Country">
          <Input
            value={country}
            onChange={setCountry}
            placeholder="United States"
            disabled={saving}
            autoComplete="country-name"
          />
        </Field>

        <AnimatePresence mode="wait">
          {feedback && <Feedback key="fb" type={feedback.type} message={feedback.message} />}
        </AnimatePresence>

        <SaveButton loading={saving} />
      </form>
    </SectionCard>
  );
}

// ── Security section ──────────────────────────────────────────────────────────

function SecuritySection({
  merchant,
  onUpdateProfile,
}: {
  merchant: PublicMerchant | null;
  onUpdateProfile: SettingsPageProps['onUpdateProfile'];
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackProps | null>(null);

  const showFeedback = useCallback((fb: FeedbackProps) => {
    setFeedback(fb);
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showFeedback({ type: 'error', message: 'Current password is required.' });
      return;
    }
    if (newPassword.length < 8) {
      showFeedback({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword.length > 128) {
      showFeedback({ type: 'error', message: 'New password must be 128 characters or fewer.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await onUpdateProfile({ currentPassword, password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showFeedback({ type: 'success', message: 'Password changed. Other active sessions have been signed out.' });
    } catch (err: any) {
      showFeedback({ type: 'error', message: err?.message || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  };

  const EyeToggle = ({
    show,
    onToggle,
  }: {
    show: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className="text-white/30 hover:text-white/60 transition-colors"
      tabIndex={-1}
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
    </button>
  );

  // Google-only accounts don't have a passwordHash; the server returns a 400 with a
  // clear message — we surface that error text directly rather than guessing client-side.

  return (
    <SectionCard
      title="Change Password"
      description="Use a strong password of 8–128 characters. Changing your password signs out all other sessions."
      icon={<Lock className="w-4 h-4 text-white/50" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Current Password">
          <Input
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Enter current password"
            disabled={saving}
            autoComplete="current-password"
            rightSlot={<EyeToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="New Password">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Min 8 characters"
              disabled={saving}
              autoComplete="new-password"
              rightSlot={<EyeToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />}
            />
          </Field>
          <Field label="Confirm New Password">
            <Input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter new password"
              disabled={saving}
              autoComplete="new-password"
              rightSlot={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
            />
          </Field>
        </div>

        {/* Strength hint */}
        <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3">
          <ChevronRight className="w-3 h-3 text-white/20 mt-0.5 shrink-0" />
          <p className="text-[11px] text-white/35 leading-relaxed">
            Password must be 8–128 characters. There are no complexity requirements, but a longer password is stronger.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {feedback && <Feedback key="fb" type={feedback.type} message={feedback.message} />}
        </AnimatePresence>

        <SaveButton loading={saving} label="Update Password" />
      </form>
    </SectionCard>
  );
}

// ── Nav tab ───────────────────────────────────────────────────────────────────

type SettingsTab = 'profile' | 'business' | 'security';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'business', label: 'Business', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'security', label: 'Security', icon: <Lock className="w-3.5 h-3.5" /> },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage({
  merchant,
  store,
  onUpdateProfile,
  onUpdateStore,
  onUploadAvatar,
  onDeleteAvatar,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <DashboardHeader title="SETTINGS" searchPlaceholder="Search settings..." />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto w-full">
        {/* Merchant identity line */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
            {merchant?.avatarUrl ? (
              <img
                src={merchant.avatarUrl}
                alt={merchant.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <User className="w-4 h-4 text-white/30" />
            )}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white/80">{merchant?.name || '—'}</p>
            <p className="text-[11px] text-white/35">{merchant?.email || ''}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold tracking-[0.07em] uppercase transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-white text-[#061128] shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Section content */}
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              <AvatarSection
                merchant={merchant}
                onUploadAvatar={onUploadAvatar}
                onDeleteAvatar={onDeleteAvatar}
              />
              <PersonalInfoSection merchant={merchant} onUpdateProfile={onUpdateProfile} />
            </motion.div>
          )}

          {activeTab === 'business' && (
            <motion.div
              key="business"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <BusinessInfoSection store={store} onUpdateStore={onUpdateStore} />
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <SecuritySection merchant={merchant} onUpdateProfile={onUpdateProfile} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
