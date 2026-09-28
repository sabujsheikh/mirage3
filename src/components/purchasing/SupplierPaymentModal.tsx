import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';
import { X } from 'lucide-react';

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  onSuccess?: () => void;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}) => {
  const { recordSupplierPayment, accounts } = useApp();
  const { currentUser } = useAuth();

  const [payAmountBdt, setPayAmountBdt] = useState<number>(0);
  const [payAmountForeign, setPayAmountForeign] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState<string>('acc_bank');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (supplier) {
      const defaultBdt = supplier.balance_payable > 0 ? supplier.balance_payable : 0;
      setPayAmountBdt(defaultBdt);
      const rate = supplier.default_exchange_rate || (supplier.currency === 'AED' ? 33.0 : supplier.currency === 'USD' ? 122.0 : 1.0);
      setPayAmountForeign(defaultBdt > 0 ? Math.round((defaultBdt / rate) * 100) / 100 : 0);
      setPayAccountId(accounts.find(a => a.id === 'acc_bank')?.id || accounts.find(a => a.type === 'asset')?.id || 'acc_bank');
      setPayDate(new Date().toISOString().slice(0, 10));
      setPayRef(`TT-${Date.now().toString().slice(-6)}`);
      setPayNotes(`Settlement of payable balance for ${supplier.name}`);
      setErrorMsg('');
    }
  }, [supplier, isOpen, accounts]);

  const handlePayBdtChange = (bdt: number) => {
    setPayAmountBdt(bdt);
    const rate = supplier.default_exchange_rate || 1;
    setPayAmountForeign(Math.round((bdt / rate) * 100) / 100);
  };

  const handlePayForeignChange = (foreign: number) => {
    setPayAmountForeign(foreign);
    const rate = supplier.default_exchange_rate || 1;
    setPayAmountBdt(Math.round(foreign * rate));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmountBdt <= 0) {
      setErrorMsg('Payment amount must be greater than 0');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await recordSupplierPayment(supplier.id, {
        amount_bdt: Number(payAmountBdt),
        amount_foreign: Number(payAmountForeign) || undefined,
        payment_account_id: payAccountId,
        payment_date: payDate,
        reference_no: payRef.trim(),
        notes: payNotes.trim(),
        actor_id: currentUser?.id,
        actor_name: currentUser?.name,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record supplier payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[6px] w-full max-w-lg overflow-hidden shadow-md">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Record supplier payment: {supplier.name}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-[var(--negative)]/10 border border-[var(--negative)]/20 rounded-[4px] text-[var(--negative)] text-xs">
              {errorMsg}
            </div>
          )}

          <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] flex items-center justify-between text-xs">
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">Payable balance</div>
              <div className={`font-semibold tabular-nums mt-0.5 ${supplier.balance_payable > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
                ৳{supplier.balance_payable.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--text-muted)]">Currency and rate</div>
              <div className="text-[var(--text)] tabular-nums mt-0.5">
                1 {supplier.currency} = ৳{supplier.default_exchange_rate}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Amount in BDT (৳) *
              </label>
              <input
                type="number"
                required
                step="1"
                value={payAmountBdt}
                onChange={(e) => handlePayBdtChange(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs tabular-nums bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-semibold"
              />
            </div>

            {supplier.currency !== 'BDT' && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Amount in {supplier.currency}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmountForeign}
                  onChange={(e) => handlePayForeignChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-xs tabular-nums bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Payment account *
              </label>
              <select
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {accounts
                  .filter(a => a.type === 'asset')
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (৳{a.balance.toLocaleString()})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Payment date
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Reference
              </label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. TT-CB-849201"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Notes
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Settlement notes, cargo batch reference"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-[4px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs rounded-[4px] hover:bg-[var(--border)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs rounded-[4px] hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
