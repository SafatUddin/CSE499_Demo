import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// ── Feedback banner ────────────────────────────────────────────────────────

export interface FeedbackProps {
  type: 'success' | 'error';
  message: string;
}

export function Feedback({ type, message }: FeedbackProps) {
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

// ── Section card wrapper ───────────────────────────────────────────────────

export function SectionCard({
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

// ── Form field label + children wrapper ───────────────────────────────────

export function Field({
  label,
  children,
  note,
  error,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[10px] text-red-400 font-medium leading-relaxed">{error}</p>
      )}
      {!error && note && (
        <p className="text-[10px] text-white/30 leading-relaxed">{note}</p>
      )}
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────

export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
  readOnly,
  rightSlot,
}: {
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  readOnly?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        className="zone-b-input w-full px-4 py-2.5 text-[13px] text-white/90 placeholder-white/20 disabled:opacity-50 disabled:cursor-not-allowed read-only:opacity-60 read-only:cursor-default"
        style={{ paddingRight: rightSlot ? '2.8rem' : undefined }}
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

// ── Submit button ─────────────────────────────────────────────────────────

export function SaveButton({
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
      {loading && (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
      )}
      {label}
    </button>
  );
}
