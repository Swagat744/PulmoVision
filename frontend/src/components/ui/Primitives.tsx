import React, { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  badge,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <div className="border-b border-[#222F43] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between bg-[#0F1523] hover:bg-[#161F30] transition text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
          )}
          {icon && <span className="text-[#0D9488] shrink-0">{icon}</span>}
          <div className="truncate">
            <span className="text-xs font-semibold tracking-wide text-[#FFFFFF] uppercase">
              {title}
            </span>
            {subtitle && (
              <span className="block text-[10px] font-mono text-[#CBD5E1] truncate">
                {subtitle}
              </span>
            )}
          </div>
        </div>
        {badge && <div className="shrink-0 ml-2">{badge}</div>}
      </button>
      {open && <div className="p-3 bg-[#080B10]/80 space-y-2.5">{children}</div>}
    </div>
  );
};

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass,
  size = 'md',
}) => {
  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };
  const effectiveWidth = maxWidthClass || sizeClasses[size] || 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B10]/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`w-full ${effectiveWidth} bg-[#0F1523] border border-[#222F43] rounded-2xl shadow-2xl overflow-hidden text-[#F8FAFC]`}
      >
        <div className="px-5 py-4 border-b border-[#222F43] flex items-center justify-between bg-[#161F30]/60">
          <div>
            <h3 className="text-sm font-bold text-[#FFFFFF] tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-[#CBD5E1] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#222F43] transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  status: string | null | undefined;
  darkEnvironment?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, darkEnvironment = true }) => {
  const norm = (status || 'UNPROCESSED').toUpperCase();
  if (norm === 'COMPLETED' || norm === 'SEGMENTED' || norm === 'ACTIVE') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
          darkEnvironment
            ? 'bg-[#0D9488]/20 text-[#14B8A6] border-[#0D9488]/40'
            : 'bg-teal-50 text-[#0D9488] border-teal-200'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
        {norm}
      </span>
    );
  }
  if (norm === 'PROCESSING' || norm === 'QUEUED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
          darkEnvironment
            ? 'bg-sky-500/20 text-[#38BDF8] border-sky-500/40'
            : 'bg-sky-50 text-sky-700 border-sky-200'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-ping" />
        {norm}
      </span>
    );
  }
  if (norm === 'FAILED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
          darkEnvironment
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        FAILED
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] font-medium border ${
        darkEnvironment
          ? 'bg-[#161F30] text-[#CBD5E1] border-[#222F43]'
          : 'bg-slate-100 text-[#64748B] border-slate-200'
      }`}
    >
      {norm}
    </span>
  );
};
