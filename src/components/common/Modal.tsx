import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZE_MAP: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Shared centered modal / record workspace.
 *
 * - Centered horizontally + vertically on a white surface with subtle border/shadow.
 * - Very subtle backdrop (no dark overlay) so surrounding UI stays contextually visible.
 * - Closes on the X button, the Escape key, or a click on the backdrop.
 * - Clicks inside the panel never close it.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  className = '',
}) => {
  // Accept both "open" and the legacy "isOpen" spelling so every existing call site works.
  const isOpen2 = open ?? isOpen;

  // Escape key closes
  useEffect(() => {
    if (!isOpen2) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen2, onClose]);

  // Freeze background scroll while open
  useEffect(() => {
    if (!isOpen2) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen2]);

  if (!isOpen2) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Very subtle theme-aware backdrop — intentionally NOT a dark overlay */}
      <div className="absolute inset-0 bg-[rgba(var(--accent-rgb),0.10)] animate-in fade-in duration-150" />

      <div
        className={`relative z-10 w-full ${SIZE_MAP[size]} ${className} bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150`}
      >
        {title !== undefined && (
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-[var(--border)] shrink-0">
            <div className="min-w-0">
              {typeof title === 'string' ? (
                <h3 className="text-[14px] sm:text-[15px] font-bold text-[var(--text)] leading-tight">{title}</h3>
              ) : (
                title
              )}
              {subtitle && <div className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-5 sm:py-3.5 border-t border-[var(--border)] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
