import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { User, Building2, Phone, Globe, MapPin, LogOut, ArrowRight } from 'lucide-react';
import { RemlinLogo } from './RemlinLogo';
import { completeProfile } from '../lib/api';
import type { PublicMerchant, PublicStore, OnboardingResponse } from '../lib/api';
import {
  SectionCard,
  Field,
  Input,
  Feedback,
} from './profile/ProfileFormParts';
import type { FeedbackProps } from './profile/ProfileFormParts';

// ── Props ──────────────────────────────────────────────────────────────────

interface OnboardingPageProps {
  merchant: PublicMerchant;
  store: PublicStore;
  onComplete: (response: OnboardingResponse) => void;
  onLogout: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OnboardingPage({
  merchant,
  store,
  onComplete,
  onLogout,
}: OnboardingPageProps) {
  // Personal information
  const [name, setName] = useState(merchant.name || '');
  const [phone, setPhone] = useState(merchant.phone || '');

  // Business information
  const [storeName, setStoreName] = useState(store.name || '');
  const [businessPhone, setBusinessPhone] = useState(store.businessPhone || '');
  const [website, setWebsite] = useState(store.website || '');
  const [streetAddress, setStreetAddress] = useState(store.streetAddress || '');
  const [city, setCity] = useState(store.city || '');
  const [province, setProvince] = useState(store.province || '');
  const [postalCode, setPostalCode] = useState(store.postalCode || '');
  const [country, setCountry] = useState(store.country || '');

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formFeedback, setFormFeedback] = useState<FeedbackProps | null>(null);

  const showFormFeedback = useCallback((fb: FeedbackProps) => {
    setFormFeedback(fb);
    const t = setTimeout(() => setFormFeedback(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormFeedback(null);
    setSaving(true);
    try {
      const response = await completeProfile({
        name: name.trim(),
        phone: phone.trim(),
        storeName: storeName.trim(),
        businessPhone: businessPhone.trim(),
        website: website.trim(),
        streetAddress: streetAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
      });
      onComplete(response);
    } catch (err: any) {
      // The API throws with err.message for generic errors, or err.fieldErrors for field-level
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setFieldErrors(err.fieldErrors);
        showFormFeedback({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        showFormFeedback({
          type: 'error',
          message: err?.message || 'Failed to save profile. Please try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen app-bg-gradient text-[#e2e2e2] font-sans flex flex-col selection:bg-white/10 selection:text-white relative">
      {/* Ambient blooms */}
      <div className="ambient-bloom-tl" />
      <div className="ambient-bloom-br" />

      {/* Minimal top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.07] zone-b-black">
        <div className="flex items-center gap-3">
          <RemlinLogo size={20} className="w-8 h-8" />
          <span className="font-extrabold text-[15px] text-white tracking-tight">Remlin</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white/70 uppercase tracking-[0.1em] transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </header>

      {/* Page content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.15em]">
              Profile Setup Required
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            Complete your business profile
          </h1>
          <p className="text-[13px] text-white/50 leading-relaxed">
            Before you can start using Remlin, we need a few details about you and your
            business. This information helps us personalise your experience.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-5">

          {/* ── Personal Information ── */}
          <SectionCard
            title="Personal Information"
            description="Your name and contact details for the merchant portal."
            icon={<User className="w-4 h-4 text-white/50" />}
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *" error={fieldErrors.name}>
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
                  note="This is your verified sign-in email and cannot be changed here."
                >
                  <Input
                    type="email"
                    value={merchant.email}
                    readOnly
                    autoComplete="email"
                  />
                </Field>
              </div>
              <Field label="Phone Number *" error={fieldErrors.phone}>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    disabled={saving}
                    autoComplete="tel"
                    className="zone-b-input w-full pl-9 pr-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50"
                  />
                </div>
              </Field>
            </div>
          </SectionCard>

          {/* ── Business Information ── */}
          <SectionCard
            title="Business Information"
            description="Your store's public-facing contact details and address."
            icon={<Building2 className="w-4 h-4 text-white/50" />}
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business / Store Name *" error={fieldErrors.storeName}>
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
                <Field label="Business Phone *" error={fieldErrors.businessPhone}>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                    <input
                      type="tel"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      placeholder="+1 (555) 000-0001"
                      disabled={saving}
                      autoComplete="tel"
                      className="zone-b-input w-full pl-9 pr-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Website" error={fieldErrors.website} note="Optional. Must start with https://">
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

              <Field label="Street Address *" error={fieldErrors.streetAddress}>
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
                <Field label="City *" error={fieldErrors.city}>
                  <Input
                    value={city}
                    onChange={setCity}
                    placeholder="New York"
                    disabled={saving}
                    autoComplete="address-level2"
                  />
                </Field>
                <Field label="Province / State *" error={fieldErrors.province}>
                  <Input
                    value={province}
                    onChange={setProvince}
                    placeholder="NY"
                    disabled={saving}
                    autoComplete="address-level1"
                  />
                </Field>
                <Field label="Postal / ZIP Code *" error={fieldErrors.postalCode}>
                  <Input
                    value={postalCode}
                    onChange={setPostalCode}
                    placeholder="10001"
                    disabled={saving}
                    autoComplete="postal-code"
                  />
                </Field>
              </div>

              <Field label="Country *" error={fieldErrors.country}>
                <Input
                  value={country}
                  onChange={setCountry}
                  placeholder="United States"
                  disabled={saving}
                  autoComplete="country-name"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Form-level feedback */}
          <AnimatePresence mode="wait">
            {formFeedback && (
              <Feedback key="form-fb" type={formFeedback.type} message={formFeedback.message} />
            )}
          </AnimatePresence>

          {/* CTA */}
          <button
            type="submit"
            disabled={saving}
            className="btn-light-primary w-full flex items-center justify-center gap-2.5 py-3.5 text-[13px] font-bold tracking-[0.06em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {saving ? 'Saving…' : 'Complete Profile & Continue'}
          </button>

          <p className="text-center text-[10px] text-white/25 leading-relaxed pb-4">
            Fields marked with * are required. You can update all information later in Settings.
          </p>
        </form>
      </main>
    </div>
  );
}
