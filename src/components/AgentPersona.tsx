import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Save,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  ImagePlus,
  ImageOff,
  Building2,
  Globe,
  Phone,
  MapPin
} from 'lucide-react';
import { AIPersona } from '../types';
import DashboardHeader from './DashboardHeader';

interface AgentPersonaProps {
  persona: AIPersona;
  onSavePersona: (newPersona: AIPersona) => Promise<void>;
  onUploadOpeningImage: (file: File) => Promise<void>;
  onDeleteOpeningImage: () => Promise<void>;
}

export default function AgentPersona({
  persona,
  onSavePersona,
  onUploadOpeningImage,
  onDeleteOpeningImage
}: AgentPersonaProps) {
  const [personaTone, setPersonaTone] = useState(persona.tone);
  const [personaStyle] = useState<'bullets' | 'narrative'>('narrative'); // Always narrative now
  const [personaInstructions, setPersonaInstructions] = useState(persona.customInstructions);
  const [autoFinalizeOrdersAlways, setAutoFinalizeOrdersAlways] = useState(!!persona.autoFinalizeOrdersAlways);
  const [openingText, setOpeningText] = useState(persona.openingText || '');
  const [shareBusinessInfo, setShareBusinessInfo] = useState(persona.shareBusinessInfo ?? true);

  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [personaError, setPersonaError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');

  const handleSavePersonaClick = async () => {
    setPersonaError('');
    setIsSavingPersona(true);
    try {
      await onSavePersona({
        tone: personaTone,
        style: personaStyle,
        customInstructions: personaInstructions,
        autoFinalizeOrdersAlways,
        openingText,
        shareBusinessInfo,
        businessInfo: persona.businessInfo
      });
      setShowSaveSuccess(true);
      setTimeout(() => {
        setShowSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setPersonaError(err.message || 'Failed to save persona.');
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) return;
    setImageError('');
    setUploadingImage(true);
    try {
      await onUploadOpeningImage(file);
    } catch (err: any) {
      setImageError(err.message || 'Failed to upload greeting image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageRemove = async () => {
    setImageError('');
    setUploadingImage(true);
    try {
      await onDeleteOpeningImage();
    } catch (err: any) {
      setImageError(err.message || 'Failed to remove greeting image.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col text-left bg-[#0a0a0b]">
      <DashboardHeader title="AI PERSONA" searchPlaceholder="Search settings…" />

      <div className="w-full flex-grow p-6 md:p-8 overflow-y-auto">
        <div className="w-full space-y-6">
          {/* Page Header */}
          <div className="space-y-1">
            <h1 className="font-sans font-bold text-[24px] text-white flex items-center gap-3 tracking-tight">
              <Sparkles className="text-[#00a8e8] h-6 w-6" />
              AI Agent Persona
            </h1>
            <p className="text-[14px] text-white/60">
              Configure how your AI assistant communicates with customers and handles orders
            </p>
          </div>

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Tone of Voice */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="font-sans font-semibold text-[15px] text-white">
                    Tone of Voice
                  </h2>
                  <p className="text-[13px] text-white/50">
                    Define how your AI assistant sounds
                  </p>
                </div>
                <textarea
                  rows={4}
                  value={personaTone}
                  onChange={(e) => setPersonaTone(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 font-sans text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#00a8e8]/50 focus:bg-white/[0.05] transition-all resize-none"
                  placeholder="e.g. Professional, high-end, elegant"
                />
              </div>

              {/* Response Format - Static Display */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="font-sans font-semibold text-[15px] text-white">
                    Response Format
                  </h2>
                  <p className="text-[13px] text-white/50">
                    AI responses are conversational by default
                  </p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#00a8e8]" />
                  <span className="text-[13px] text-white/80 font-medium">Conversational</span>
                </div>
              </div>

              {/* Sales Rules */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="font-sans font-semibold text-[15px] text-white">
                    Sales Rules & Guidelines
                  </h2>
                  <p className="text-[13px] text-white/50">
                    Custom instructions for sales and promotions
                  </p>
                </div>
                <textarea
                  rows={6}
                  value={personaInstructions}
                  onChange={(e) => setPersonaInstructions(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 font-sans text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#00a8e8]/50 focus:bg-white/[0.05] transition-all resize-none"
                  placeholder="e.g. Free shipping on orders over $150. Suggest adding complementary accessories."
                />
              </div>

              {/* Order Management - Informational Only */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="font-sans font-semibold text-[15px] text-white">
                    Order Management
                  </h2>
                </div>
                <div className="bg-[#00a8e8]/5 border border-[#00a8e8]/20 rounded-xl p-4">
                  <p className="text-[13px] text-white/80 leading-relaxed">
                    When a customer confirms their order, the AI automatically places it if <span className="font-semibold text-white">AI Copilot is on</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Business Information Sharing */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-sans font-semibold text-[15px] text-white flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#00a8e8]" />
                      Business Information
                    </h2>
                    <p className="text-[13px] text-white/50">
                      Share your contact details with customers
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareBusinessInfo(!shareBusinessInfo)}
                    className={`relative w-12 h-7 rounded-full transition-all flex-shrink-0 ${
                      shareBusinessInfo
                        ? 'bg-gradient-to-r from-[#2176ff] via-[#00a8e8] to-[#00d2ff]'
                        : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                        shareBusinessInfo ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Editable Business Info Fields */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[12px] text-white/60 font-medium flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Business Phone
                    </label>
                    <input
                      type="text"
                      value={persona.businessInfo?.businessPhone || ''}
                      readOnly
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                      placeholder="Not set"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] text-white/60 font-medium flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Website
                    </label>
                    <input
                      type="text"
                      value={persona.businessInfo?.website || ''}
                      readOnly
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                      placeholder="Not set"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] text-white/60 font-medium flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Street Address
                    </label>
                    <input
                      type="text"
                      value={persona.businessInfo?.streetAddress || ''}
                      readOnly
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                      placeholder="Not set"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[12px] text-white/60 font-medium">City</label>
                      <input
                        type="text"
                        value={persona.businessInfo?.city || ''}
                        readOnly
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                        placeholder="Not set"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] text-white/60 font-medium">Province/State</label>
                      <input
                        type="text"
                        value={persona.businessInfo?.province || ''}
                        readOnly
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                        placeholder="Not set"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[12px] text-white/60 font-medium">Postal Code</label>
                      <input
                        type="text"
                        value={persona.businessInfo?.postalCode || ''}
                        readOnly
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                        placeholder="Not set"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] text-white/60 font-medium">Country</label>
                      <input
                        type="text"
                        value={persona.businessInfo?.country || ''}
                        readOnly
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5 font-sans text-[13px] text-white/70 outline-none"
                        placeholder="Not set"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-white/40 italic pt-1">
                    Update business information in Settings → Profile
                  </div>
                </div>

                {/* Status Indicator */}
                <div className={`rounded-xl p-3 ${
                  shareBusinessInfo 
                    ? 'bg-emerald-500/10 border border-emerald-500/20' 
                    : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  <p className={`text-[12px] leading-relaxed ${
                    shareBusinessInfo ? 'text-emerald-300/90' : 'text-amber-300/90'
                  }`}>
                    {shareBusinessInfo
                      ? '✓ AI will share this information when customers ask about your location or contact details.'
                      : '○ AI will respond: "We operate entirely online to bring you the best selection of products directly."'}
                  </p>
                </div>
              </div>

              {/* Opening Greeting */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="font-sans font-semibold text-[15px] text-white">
                    Opening Greeting
                  </h2>
                  <p className="text-[13px] text-white/50">
                    First message sent to new customers
                  </p>
                </div>

                <textarea
                  rows={3}
                  value={openingText}
                  onChange={(e) => setOpeningText(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 font-sans text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#00a8e8]/50 focus:bg-white/[0.05] transition-all resize-none"
                  placeholder="e.g. Hey there! Thanks for reaching out to us — how can I help you today?"
                />

                <div className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <label
                    className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 cursor-pointer group"
                    title={persona.openingImageUrl ? 'Change greeting photo' : 'Add greeting photo'}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={(e) => handleImageSelect(e.target.files?.[0])}
                    />
                    {persona.openingImageUrl ? (
                      <img src={persona.openingImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-white/30" />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {uploadingImage ? (
                        <span className="text-[10px] text-white font-bold">...</span>
                      ) : (
                        <ImagePlus className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </label>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[12px] text-white/70">Optional greeting photo</p>
                    <p className="text-[11px] text-white/40">PNG, JPG, WebP or GIF</p>
                    {persona.openingImageUrl && (
                      <button
                        type="button"
                        onClick={handleImageRemove}
                        disabled={uploadingImage}
                        className="text-[11px] text-white/50 hover:text-red-400 transition-colors disabled:opacity-40 flex items-center gap-1 mt-1"
                      >
                        <ImageOff className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {imageError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-[12px] text-red-300/90">{imageError}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save Button - Full Width at Bottom */}
          <div className="space-y-3 pt-4">
            <button
              onClick={handleSavePersonaClick}
              disabled={isSavingPersona}
              className="w-full bg-gradient-to-r from-[#2176ff] via-[#00a8e8] to-[#00d2ff] hover:from-[#1a5fd9] hover:via-[#0096d0] hover:to-[#00b8e0] py-3.5 rounded-xl font-sans font-bold text-[14px] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#00a8e8]/25"
            >
              <Save className="h-4 w-4" />
              {isSavingPersona ? 'Redeploying Model...' : 'Save & Redeploy Persona'}
            </button>

            <AnimatePresence>
              {personaError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-center gap-3"
                >
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <p className="text-[13px] text-red-300/90">{personaError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSaveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-3"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-[13px] text-emerald-300/90">Persona model redeployed successfully!</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}
