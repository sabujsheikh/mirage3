import React from 'react';
import {
  Star,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  FileText,
} from 'lucide-react';
import { Order } from '../../types';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';

interface CustomerProfileModalProps {
  data: {
    customerName: string;
    phone: string;
    address: string;
    rating: number;
    notes: string;
    stats: any;
    orders: Order[];
  } | null;
  onClose: () => void;
  onUpdateRating: (newRating: number) => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  data,
  onClose,
  onUpdateRating,
}) => {
  if (!data) return null;

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center font-bold text-xs">
            {data.customerName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text)]">{data.customerName}</h3>
            <div className="text-[11px] font-num text-[var(--accent)] font-semibold">{data.phone}</div>
          </div>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className="text-[var(--text-secondary)]">Internal Customer Rating:</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                onClick={() => onUpdateRating(star)}
                className={`w-4 h-4 cursor-pointer transition-colors ${
                  star <= data.rating
                    ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]'
                    : 'text-[var(--border)] hover:text-[var(--accent-secondary)]'
                }`}
              />
            ))}
            <span className="font-num font-bold text-[var(--text)] ml-1 text-xs">{data.rating}.0 / 5</span>
          </div>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="erp-btn-secondary text-xs"
        >
          Close Profile
        </button>
      }
    >
      <div className="space-y-4">
        {/* Customer Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Lifetime Spend</div>
            <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
              ৳{data.stats.totalSpend.toLocaleString()}
            </div>
          </div>

          <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Total Orders</div>
            <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
              {data.stats.total}
            </div>
          </div>

          <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Delivered</div>
            <div className="text-base font-bold font-num text-[var(--status-green)] mt-0.5">
              {data.stats.completed}
            </div>
          </div>

          <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">RTO / Returns</div>
            <div className="text-base font-bold font-num text-[var(--status-red)] mt-0.5">
              {data.stats.refunded}
            </div>
          </div>

          <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Success Rate</div>
            <div className="text-base font-bold font-num text-[var(--status-teal)] mt-0.5">
              {data.stats.successRate !== null ? `${data.stats.successRate}%` : 'New'}
            </div>
          </div>

          <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Avg Order Value</div>
            <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
              ৳{data.stats.avgOrderValue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Risk & Behavior Signals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div
            className={`p-3 rounded-lg border flex items-center gap-2.5 ${
              data.stats.isRisk ? 'pill-red' : 'pill-green'
            }`}
          >
            {data.stats.isRisk ? (
              <>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-bold">High Delivery Risk Flag:</span> History of returns or cancellations. Require advance delivery payment or phone confirmation before dispatch.
                </div>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-bold">Verified Reliable Customer:</span> High delivery acceptance rate. Safe for immediate courier dispatch without advance deposit.
                </div>
              </>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Preferred Channel:</span>
              <span className="font-semibold text-[var(--text)]">{data.stats.preferredChannel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Preferred Fulfillment:</span>
              <span className="font-semibold text-[var(--text)]">{data.stats.preferredFulfillment}</span>
            </div>
          </div>
        </div>

        {/* Saved Delivery Addresses & Customer Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-1">
            <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Primary Delivery Address</span>
            </div>
            <div className="text-[var(--text-secondary)]">{data.address}</div>
          </div>

          <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-1">
            <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Customer Relationship Notes</span>
            </div>
            <div className="text-[var(--text-secondary)]">{data.notes}</div>
          </div>
        </div>

        {/* Full Itemized Lifetime Purchase History */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="font-semibold text-xs text-[var(--text)] uppercase tracking-wider">
              Lifetime Purchase History ({data.orders.length} orders)
            </h4>
          </div>

          <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs max-h-56 overflow-y-auto">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Order / Date</th>
                  <th>Items &amp; SKUs</th>
                  <th>Channel / Method</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[var(--surface-hover)]">
                    <td>
                      <div className="font-num font-bold text-[var(--accent)]">
                        {ord.invoice_number}
                        {ord.sale_type === 'wholesale' && (
                          <span className="ml-1.5 text-[9px] uppercase font-bold bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] px-1 py-0.5 rounded">
                            WS
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] font-num">
                        {new Date(ord.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className="font-medium text-[var(--text)]">{it.product_name}</span>{' '}
                            <span className="text-[var(--text-secondary)] font-num">({it.quantity}x @ ৳{it.unit_price})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="capitalize text-[11px]">{ord.channel}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] capitalize">{ord.fulfillment_method.replace('_', ' ')}</div>
                    </td>
                    <td className="text-right font-num font-bold">
                      ৳{ord.total.toLocaleString()}
                    </td>
                    <td className="text-center">
                      <StatusBadge status={ord.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
