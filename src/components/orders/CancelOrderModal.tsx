import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { Order } from '../../types';
import { Modal } from '../common/Modal';

interface CancelOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: string, reason: string) => Promise<void>;
}

const CANCELLATION_REASONS = [
  'Customer changed their mind',
  'Product out of stock',
  'Duplicate order',
  'Wrong item/details entered',
  'Customer unreachable / no response',
  'Price/payment disagreement',
  'Suspected fake/fraudulent order',
  'Other (please specify)',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order || !isOpen) return null;

  const handleConfirm = async () => {
    if (!reason) return;
    const finalReason = reason === 'Other (please specify)'
      ? `Other (please specify): ${otherReason.trim()}`
      : reason;
    if (!finalReason) return;

    setIsSubmitting(true);
    try {
      await onConfirm(order.id, finalReason);
      setReason('');
      setOtherReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => { if (!isSubmitting) onClose(); }}
      title="Cancel Order"
      subtitle={`${order.invoice_number} · ${order.customer_name}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="erp-btn-secondary text-xs"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Order
          </button>
          <button
            type="button"
            className="erp-btn-primary !bg-[var(--status-red)] text-xs flex items-center gap-1.5"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              !reason ||
              (reason === 'Other (please specify)' && !otherReason.trim())
            }
          >
            <XCircle className="w-3.5 h-3.5" />
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--status-amber)]/30 bg-[var(--status-amber)]/5 p-3 text-xs text-[var(--text)] leading-relaxed">
          This changes the order status permanently. Confirmed orders release their reservation. Orders that have already left the shelf require a separate physical scan-back if the stock returns.
        </div>
        <label className="block text-xs font-semibold text-[var(--text)]">
          Cancellation reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="erp-select w-full mt-1.5 text-xs"
          >
            <option value="">Select a reason</option>
            {CANCELLATION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {reason === 'Other (please specify)' && (
          <label className="block text-xs font-semibold text-[var(--text)]">
            Details required
            <textarea
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className="erp-input w-full mt-1.5 min-h-20 text-xs"
              placeholder="Explain why this order is being cancelled"
            />
          </label>
        )}
      </div>
    </Modal>
  );
};
