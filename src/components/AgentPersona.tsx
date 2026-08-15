import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Save,
  CheckCircle,
  AlertCircle,
  List,
  MessageCircle,
  ImagePlus,
  ImageOff
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
  const [personaStyle, setPersonaStyle] = useState<'bullets' | 'narrative'>(persona.style);
  const [personaInstructions, setPersonaInstructions] = useState(persona.customInstructions);
  const [autoFinalizeOrdersAlways, setAutoFinalizeOrdersAlways] = useState(!!persona.autoFinalizeOrdersAlways);
  const [openingText, setOpeningText] = useState(persona.openingText || '');

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
        openingText
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
    <div className="w-full flex-grow flex flex-col text-left">
      <DashboardHeader title="AI PERSONA" searchPlaceholder="Search settings…" />

      <div className="w-full flex-grow space-y-6 p-6 md:p-8">
        <div className="max-w-3xl mx-auto zone-b-grey3 p-6 space-y-5">
          <div className="pb-4 border-b border-white/[0.07]">
            <h3 className="font-sans font-bold text-[19px] text-white flex items-center gap-2 tracking-tight">
              <Sparkles className="text-[#7aa8ff] h-5 w-5" />
              AI agent persona
            </h3>
            <p className="text-[13px] text-white/55 mt-0.5">
              Parameters guiding real-time automated merchant responses
            </p>
          </div>

          {/* Tone of voice */}
          <div className="space-y-2 text-left">
            <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
              Tone-of-voice guidelines
            </label>
            <textarea
              rows={3}
              value={personaTone}
              onChange={(e) => setPersonaTone(e.target.value)}
              className="w-full zone-b-input p-3 font-sans text-xs outline-none resize-none"
              placeholder="e.g. Professional, high-end, elegant"
            />
          </div>

          {/* Response layout style */}
          <div className="space-y-2 text-left">
            <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
              Response layout style
            </label>
            <div className="grid grid-cols-2 bg-black/45 border border-white/10 p-1 rounded-[13px]">
              <button
                type="button"
                onClick={() => setPersonaStyle('bullets')}
                className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  personaStyle === 'bullets'
                    ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                <List className="h-4 w-4" />
                Bullet points
              </button>
              <button
                type="button"
                onClick={() => setPersonaStyle('narrative')}
                className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  personaStyle === 'narrative'
                    ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                Conversational
              </button>
            </div>
          </div>

          {/* Custom sales rules */}
          <div className="space-y-2 text-left">
            <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
              Direct sales rules & guardrails
            </label>
            <textarea
              rows={4}
              value={personaInstructions}
              onChange={(e) => setPersonaInstructions(e.target.value)}
              className="w-full zone-b-input p-3 font-sans text-xs outline-none resize-none"
              placeholder="e.g. Free shipping on orders over $150. Suggest adding complementary accessories."
            />
          </div>

          {/* Order auto-finalization segmented control */}
          <div className="space-y-2 text-left">
            <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
              Order auto-finalization
            </label>
            <p className="text-[12px] text-white/50 leading-relaxed">
              When a customer explicitly confirms their order details, should the AI place the order automatically?
            </p>
            <div className="grid grid-cols-2 bg-black/45 border border-white/10 p-1 rounded-[13px]">
              <button
                type="button"
                onClick={() => setAutoFinalizeOrdersAlways(false)}
                className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  !autoFinalizeOrdersAlways
                    ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                AI managed only
              </button>
              <button
                type="button"
                onClick={() => setAutoFinalizeOrdersAlways(true)}
                className={`py-2 rounded-lg font-sans text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  autoFinalizeOrdersAlways
                    ? 'bg-gradient-to-b from-white/20 to-white/[0.07] border border-white/20 text-white shadow-md'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                Always
              </button>
            </div>
            <p className="text-[11px] status-warning p-2.5 rounded-xl leading-relaxed mt-2">
              {autoFinalizeOrdersAlways
                ? 'The AI can finalize a confirmed order even when Copilot is set to Manual.'
                : 'The AI auto-finalizes orders only when Copilot is set to AI managed.'}
            </p>
          </div>

          {/* Opening greeting */}
          <div className="space-y-2 text-left pt-4 border-t border-white/[0.07]">
            <label className="text-[11px] text-white/60 font-bold tracking-[0.10em] block">
              Opening greeting
            </label>
            <p className="text-[12px] text-white/50 leading-relaxed">
              Sent automatically the very first time a customer messages your business on a connected channel — before the AI's actual reply. Leave blank to skip it.
            </p>
            <textarea
              rows={3}
              value={openingText}
              onChange={(e) => setOpeningText(e.target.value)}
              className="w-full zone-b-input p-3 font-sans text-xs outline-none resize-none"
              placeholder="e.g. Hey there! Thanks for reaching out to us — how can I help you today?"
            />

            <div className="flex items-center gap-3 pt-1">
              <label
                className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 cursor-pointer group/thumb"
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
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingImage ? (
                    <span className="text-[9px] text-white font-bold">...</span>
                  ) : (
                    <ImagePlus className="h-4 w-4 text-white" />
                  )}
                </div>
              </label>
              <div className="space-y-1">
                <p className="text-[12px] text-white/60">Optional photo sent alongside the greeting</p>
                {persona.openingImageUrl && (
                  <button
                    type="button"
                    onClick={handleImageRemove}
                    disabled={uploadingImage}
                    className="text-[11px] text-white/40 hover:text-[#ff9d92] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  >
                    <ImageOff className="h-3 w-3" /> Remove photo
                  </button>
                )}
              </div>
            </div>

            {imageError && (
              <div className="status-danger text-xs p-3 rounded-xl text-center font-sans">
                {imageError}
              </div>
            )}
          </div>

          {/* Model redeployment button */}
          <div className="pt-4 border-t border-white/[0.07] space-y-3">
            <button
              onClick={handleSavePersonaClick}
              disabled={isSavingPersona}
              className="w-full btn-light-primary py-3 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSavingPersona ? 'Redeploying model…' : 'Redeploy persona model'}
            </button>

            <AnimatePresence>
              {personaError && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="status-danger p-3 rounded-xl text-center font-sans text-xs flex items-center justify-center gap-2"
                >
                  <AlertCircle className="h-4 w-4" /> {personaError}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSaveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="status-success p-3 rounded-xl text-center font-sans text-xs flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" /> Model redeployed successfully!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
