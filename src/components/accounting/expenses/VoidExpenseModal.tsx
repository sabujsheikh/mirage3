import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { ExpenseRecord } from '../../../types';

interface VoidExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseRecord | null;
  onConfirmVoid: (id: string, reason: string) => Promise<void>;
}

export const VoidExpenseModal: React.FC<VoidExpenseModalProps> = ({
  isOpen,
  onClose,
  expense,
  onConfirmVoid,
}) => {
  if (!isOpen || !expense) return null;

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Please specify a valid reason for voiding this expense voucher.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onConfirmVoid(expense.id, reason.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to void expense voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[color-mix(in_srgb,var(--status-red)_12%,transparent)] text-[var(--status-red)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Void Expense Voucher</h3>
              <p className="text-xs text-[var(--text-muted)] font-mono">{expense.expense_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)]">
              {errorMsg}
            </div>
          )}

          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Description:</span>
              <span className="font-bold text-[var(--text)]">{expense.description}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Category:</span>
              <span className="font-bold text-[var(--accent)]">
                {expense.category_name || expense.category} {expense.subcategory ? `(${expense.subcategory})` : ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Amount:</span>
              <span className="font-mono font-black text-sm text-[var(--status-red)]">
                &#2547;{expense.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Paid From:</span>
              <span className="text-[var(--text)] font-semibold">{expense.payment_account_name}</span>
            </div>
          </div>

          {/* Reversal Explanation */}
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3 text-[var(--accent)]" />
              <span>Accounting Reversal Posting Preview</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-2">
              Voiding will create an automatic reversing journal entry to restore the paid funds and zero out the expense:
            </p>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-[var(--status-teal)]">
                <span>Dr. {expense.payment_account_name} (Cash/Bank restored)</span>
                <span>&#2547;{expense.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)] pl-3">
                <span>Cr. {expense.expense_account_name} (Expense reversed)</span>
                <span>&#2547;{expense.amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[var(--text)] mb-1">
              Reason for Voiding * <span className="text-[10px] font-normal text-[var(--text-muted)]">(recorded in audit log)</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Incorrect cash amount entered, duplicate voucher entered by staff, cancelled transaction..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 bg-[var(--status-red)] text-white font-bold rounded-lg hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Voiding...' : 'Confirm & Reverse Ledger'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
