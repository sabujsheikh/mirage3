import React, { useState } from 'react';
import {
  Boxes,
  Calendar,
  Building2,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Pencil,
  Printer,
  Tag,
  AlertTriangle,
  Truck,
  Clock,
  CreditCard,
  Plus,
  Wallet,
  Check,
  Send,
  Gift,
} from 'lucide-react';
import { Order } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  orderPaymentState,
  paymentMethodLabel,
  paymentAccountLabel,
} from './orderHelpers';

interface OrderWorkspaceModalProps {
  order: Order | null;
  onClose: () => void;
  onMoveToToday?: (order: Order) => Promise<void>;
  isMoving?: boolean;
  onCancelOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onViewInvoice?: (order: Order) => void;
  onPrintMerchantSticker?: (order: Order) => void;
}

export const OrderWorkspaceModal: React.FC<OrderWorkspaceModalProps> = ({
  order,
  onClose,
  onMoveToToday,
  isMoving = false,
  onCancelOrder,
  onEditOrder,
  onViewInvoice,
  onPrintMerchantSticker,
}) => {
  const { can } = useAuth();
  const { courierBookings, accounts, recordOrderPayment, bookCourier, refreshAll } = useApp();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'bkash' | 'nagad' | 'bank' | 'cash' | 'card'>('bkash');
  const [payAccount, setPayAccount] = useState<string>('acc_bkash');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  const [isBookingCourier, setIsBookingCourier] = useState(false);
  const [bookingCourierError, setBookingCourierError] = useState<string | null>(null);
  const [bookingCourierSuccess, setBookingCourierSuccess] = useState<string | null>(null);

  if (!order) return null;

  const linkedBooking = courierBookings.find(
    (b) => b.order_id === order.id || (order.courier_tracking_code && b.consignment_no === order.courier_tracking_code)
  );

  const handleBookCourierInModal = async () => {
    if (isBookingCourier) return;
    setIsBookingCourier(true);
    setBookingCourierError(null);
    setBookingCourierSuccess(null);
    try {
      const booked = await bookCourier(order.id);
      const tracking = booked.courier_tracking_code || booked.courier_consignment_id || 'booked';
      setBookingCourierSuccess(`Successfully booked with Steadfast! Consignment #${tracking}`);
      await refreshAll();
    } catch (err: any) {
      console.error('Failed to book Steadfast order from modal:', err);
      setBookingCourierError(err.message || 'Courier API booking error');
    } finally {
      setIsBookingCourier(false);
    }
  };

  const ps = orderPaymentState(order);
  const payments = order.payments || [];
  const remainingDue = Math.max(0, (order.total || 0) - ps.received);

  const handleRecordPaymentSubmit = async () => {
    if (payAmount <= 0) {
      setPayError('Please enter a valid payment amount greater than 0.');
      return;
    }
    if (payAmount > remainingDue) {
      setPayError(`Payment amount (৳${payAmount}) exceeds remaining balance due (৳${remainingDue}).`);
      return;
    }

    try {
      setIsSubmittingPay(true);
      setPayError(null);
      await recordOrderPayment(order.id, {
        amount: payAmount,
        method: payMethod,
        payment_account_id: payAccount,
        transaction_ref: payRef || undefined,
        notes: payNotes || undefined,
      });
      setPaySuccessMsg(`Successfully recorded ৳${payAmount.toLocaleString()} payment via ${payMethod.toUpperCase()}!`);
      setShowPaymentForm(false);
      setPayRef('');
      setPayNotes('');
      setTimeout(() => setPaySuccessMsg(null), 4000);
    } catch (err: any) {
      setPayError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5 flex-wrap">
          <span>Order Workspace: {order.invoice_number}</span>
          <StatusBadge status={order.status} size="sm" />
          {order.order_timing === 'pre_order' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
              <Boxes className="w-3 h-3" />
              <span>Pre-Order</span>
            </span>
          )}
          {order.order_timing === 'scheduled' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <Calendar className="w-3 h-3" />
              <span>Scheduled {order.scheduled_date ? `for ${order.scheduled_date}` : ''}</span>
            </span>
          )}
        </span>
      }
      subtitle={
        <span>
          Created on {new Date(order.created_at).toLocaleString()} by {order.created_by_name}
        </span>
      }
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          {(order.order_timing === 'pre_order' || order.order_timing === 'scheduled') &&
            order.status !== 'cancelled' &&
            onMoveToToday && (
              <button
                type="button"
                onClick={() => onMoveToToday(order)}
                disabled={isMoving}
                className="erp-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
              >
                {isMoving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Move to Today&apos;s Orders</span>
              </button>
            )}

          {order.status !== 'cancelled' && onCancelOrder && (
            <button
              type="button"
              onClick={() => onCancelOrder(order)}
              className="erp-btn-secondary text-[var(--status-red)] border-[var(--status-red)] text-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Order</span>
            </button>
          )}

          {order.status === 'confirmed' && can('create_edit_orders') && onEditOrder && (
            <button
              type="button"
              onClick={() => onEditOrder(order)}
              className="erp-btn-secondary text-xs"
            >
              <Pencil className="w-3.5 h-3.5 text-[var(--status-amber)]" />
              <span>Edit Order</span>
            </button>
          )}

          {order.order_type !== 'merchant_fulfillment' && onViewInvoice && (
            <button
              type="button"
              onClick={() => onViewInvoice(order)}
              className="erp-btn-primary text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>View &amp; Print Invoice</span>
            </button>
          )}

          {order.order_type === 'merchant_fulfillment' && onPrintMerchantSticker && (
            <button
              type="button"
              onClick={() => onPrintMerchantSticker(order)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[color-mix(in_srgb,var(--status-purple)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--status-purple)_20%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_30%,transparent)] flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Merchant Sticker</span>
            </button>
          )}

          {!linkedBooking && !order.courier_booked && (order.fulfillment_method === 'steadfast' || !order.fulfillment_method) && ['confirmed', 'packed'].includes(order.status) && (
            <button
              type="button"
              onClick={handleBookCourierInModal}
              disabled={isBookingCourier}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Book order with Steadfast Courier immediately"
            >
              {isBookingCourier ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Booking Steadfast...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Book Steadfast</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="erp-btn-secondary text-xs ml-auto"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {bookingCourierSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bookingCourierSuccess}</span>
          </div>
        )}

        {bookingCourierError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{bookingCourierError}</span>
          </div>
        )}
        {order.status === 'cancelled' && (
          <div className="rounded-lg border border-[var(--status-red)]/30 bg-[var(--status-red)]/5 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-[var(--status-red)]">
                <XCircle className="w-4 h-4" />
                <span>Cancelled Order Record</span>
              </div>
              <StatusBadge status="cancelled" size="sm" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="block text-[10px] text-[var(--text-secondary)] uppercase">Cancelled From</span>
                <strong>{order.cancelled_from_status || '—'}</strong>
              </div>
              <div>
                <span className="block text-[10px] text-[var(--text-secondary)] uppercase">Cancelled At</span>
                <strong>{order.cancelled_at ? new Date(order.cancelled_at).toLocaleString() : '—'}</strong>
              </div>
              <div>
                <span className="block text-[10px] text-[var(--text-secondary)] uppercase">Cancelled By</span>
                <strong>{order.cancelled_by_name || '—'}</strong>
              </div>
              <div>
                <span className="block text-[10px] text-[var(--text-secondary)] uppercase">Refunded</span>
                <strong className="font-num">৳{(order.refunded_amount || 0).toLocaleString()}</strong>
              </div>
            </div>
            <div>
              <span className="font-semibold">Reason:</span> {order.cancel_reason || '—'}
            </div>
            {order.physical_recovery_required && (
              <div className="flex items-center gap-1.5 text-[var(--status-amber)] font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Physical stock recovery requires a separate scan-back.
              </div>
            )}
          </div>
        )}

        {/* Dropship Fulfillment Badge & Details */}
        {order.order_type === 'merchant_fulfillment' && (
          <div className="p-3 bg-[color-mix(in_srgb,var(--status-purple)_8%,transparent)] border border-[color-mix(in_srgb,var(--status-purple)_25%,transparent)] rounded-lg text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-purple)_16%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_35%,transparent)]">
                  <Building2 className="w-3 h-3" />
                  <span>Dropship Fulfillment</span>
                </span>
              </div>
              {onPrintMerchantSticker && (
                <button
                  type="button"
                  onClick={() => onPrintMerchantSticker(order)}
                  className="text-[11px] font-bold text-[var(--status-purple)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Tag className="w-3 h-3" />
                  <span>Print Thermal Sticker</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Merchant / Company</span>
                <span className="font-semibold text-[var(--text)]">{order.merchant_name || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Merchant ID</span>
                <span className="font-mono font-semibold text-[var(--text)]">{order.merchant_id || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Parcel ID</span>
                <span className="font-mono font-bold text-[var(--status-purple)]">{order.parcel_id || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">End Customer Name</span>
                <span className="font-semibold text-[var(--text)]">{order.end_customer_name || order.customer_name}</span>
              </div>
            </div>
          </div>
        )}

        {/* Customer & Address Details */}
        <div className="grid grid-cols-2 gap-3 bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] text-xs">
          <div>
            <div className="font-semibold text-[var(--text-secondary)] text-[10px] uppercase">
              {order.order_type === 'merchant_fulfillment' ? 'Recipient / End Customer' : 'Customer'}
            </div>
            <div className="font-semibold text-sm text-[var(--text)] mt-0.5">{order.customer_name}</div>
            <div className="font-num text-[var(--accent)] font-semibold mt-0.5">{order.customer_phone}</div>
          </div>
          <div>
            <div className="font-semibold text-[var(--text-secondary)] text-[10px] uppercase">Fulfillment &amp; Delivery</div>
            <div className="capitalize font-semibold text-[var(--text)] mt-0.5">{order.fulfillment_method.replace('_', ' ')}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{order.delivery_address_text || 'Showroom In-Store Handoff'}</div>
          </div>
        </div>

        {/* Highlighted Internal Packing Note */}
        {order.packing_note && (
          <div className="p-3 bg-[color-mix(in_srgb,var(--status-amber)_15%,var(--surface))] border border-[color-mix(in_srgb,var(--status-amber)_35%,transparent)] rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--status-amber)]">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-amber)]" />
              <span>PACKING NOTE (INTERNAL FOR PACKING TEAM)</span>
            </div>
            <p className="font-semibold text-xs text-[var(--text)] whitespace-pre-wrap pl-5">
              {order.packing_note}
            </p>
          </div>
        )}

        {/* Steadfast Courier Booking & Carrier Cost Breakdown */}
        {linkedBooking && (
          <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-[var(--text)]">
                <Truck className="w-4 h-4 text-[var(--accent)]" />
                <span>Steadfast Consignment: {linkedBooking.consignment_no}</span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">
                {linkedBooking.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Customer Delivery</span>
                <span className="font-bold font-num text-[var(--text)]">৳{order.delivery_charge}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Estimated Charge</span>
                <span className="font-num text-[var(--text-muted)]">৳{linkedBooking.estimated_charge ?? 60}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Confirmed Actual Fee</span>
                {linkedBooking.actual_charge != null ? (
                  <div className="flex items-center gap-1 font-num font-bold text-[var(--text)]">
                    <span>৳{linkedBooking.actual_charge}</span>
                    <span className="text-[8px] uppercase px-1 py-0.2 rounded font-bold bg-[var(--surface)] border border-[var(--border)]">
                      {linkedBooking.courier_charge_source === 'steadfast_api' ? 'API' : 'Manual'}
                    </span>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    Pending Actual
                  </span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Delivery Variance</span>
                {linkedBooking.actual_charge != null && linkedBooking.variance != null ? (
                  <span className={`font-num font-bold ${linkedBooking.variance >= 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'}`}>
                    {linkedBooking.variance >= 0 ? '+' : ''}৳{linkedBooking.variance}
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] italic">
                    Pending
                  </span>
                )}
              </div>
            </div>
            {linkedBooking.actual_charge == null && (
              <p className="text-[10px] text-[var(--text-muted)] italic">
                * Note: Estimated booking charge is not used for accounting delivery variance. Actual fee will be recorded once confirmed via Steadfast API or entered manually by staff.
              </p>
            )}
          </div>
        )}

        {/* Items Table */}
        <div>
          <div className="text-xs font-semibold text-[var(--text)] mb-1.5 uppercase">Items Ordered</div>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Perfume Item</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Item Discount</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-[var(--text)]">{it.product_name}</td>
                    <td className="text-center font-num font-bold text-[var(--text)]">{it.quantity}</td>
                    <td className="text-right font-num text-[var(--text)]">৳{it.unit_price}</td>
                    <td className="text-right font-num">
                      {it.discount_amount > 0 ? (
                        <span className="status-red">-৳{it.discount_amount.toLocaleString()}</span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="text-right font-num font-bold text-[var(--text)]">৳{it.total_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Free Testers / Samples */}
        {order.testers && order.testers.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-[var(--status-green)] mb-1.5 uppercase flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5" />
              <span>Free Testers / Samples Included ({order.testers.length} items)</span>
            </div>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs bg-[var(--surface)]">
              <table className="dense-table">
                <thead>
                  <tr>
                    <th>Sample Fragrance</th>
                    <th>SKU</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {order.testers.map((t, idx) => (
                    <tr key={idx}>
                      <td className="font-medium text-[var(--text)]">{t.product_name}</td>
                      <td className="font-mono text-[var(--text-secondary)]">{t.sku || '—'}</td>
                      <td className="text-center font-num font-bold text-[var(--text)]">{t.quantity}</td>
                      <td className="text-right font-semibold text-[var(--status-green)]">Free (৳0)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Gross Subtotal:</span>
            <span className="font-num text-[var(--text)]">৳{(order.subtotal || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Delivery Charge:</span>
            <span className="font-num text-[var(--text)]">৳{(order.delivery_charge || 0).toLocaleString()}</span>
          </div>
          {(order.items || []).reduce((s, it) => s + (it.discount_amount || 0), 0) > 0 && (
            <div className="flex justify-between status-red">
              <span>Item Discounts:</span>
              <span className="font-num">
                -৳{(order.items || []).reduce((s, it) => s + (it.discount_amount || 0), 0).toLocaleString()}
              </span>
            </div>
          )}
          {(order.discount_amount || 0) > 0 && (
            <div className="flex justify-between status-red">
              <span>Overall Discount:</span>
              <span className="font-num">-৳{order.discount_amount.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-[var(--border)] pt-1.5 flex justify-between font-bold text-sm text-[var(--accent)]">
            <span>Total Amount:</span>
            <span className="font-num">৳{(order.total || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-bold text-[var(--text)] uppercase tracking-wider text-[11px]">Payment &amp; Receivable Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  ps.state === 'paid'
                    ? 'bg-[var(--status-green)]/15 text-[var(--status-green)]'
                    : ps.state === 'unpaid'
                    ? 'bg-[var(--status-red)]/15 text-[var(--status-red)]'
                    : ps.state === 'partial' || ps.state === 'partial_refund'
                    ? 'bg-[var(--status-amber)]/15 text-[var(--status-amber)]'
                    : 'bg-[var(--status-gray)]/15 text-[var(--status-gray)]'
                }`}
              >
                {ps.label}
              </span>
              {remainingDue > 0 && order.status !== 'cancelled' && !showPaymentForm && (
                <button
                  type="button"
                  onClick={() => {
                    setPayAmount(remainingDue);
                    setShowPaymentForm(true);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Payment</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar: Total | Received | Customer Due | Remaining Courier COD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)] text-xs">
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Order Total</span>
              <span className="font-num font-bold text-[var(--text)]">৳{(order.total || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Direct Received</span>
              <span className="font-num font-bold text-[var(--status-green)]">৳{ps.received.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Customer Due</span>
              <span className={`font-num font-bold ${remainingDue > 0 ? 'status-red' : 'text-[var(--text-secondary)]'}`}>
                ৳{remainingDue.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Courier COD Due</span>
              <span className="font-num font-bold text-[var(--accent)]">
                ৳{(linkedBooking ? (linkedBooking.cod_amount ?? 0) : remainingDue).toLocaleString()}
              </span>
            </div>
          </div>

          {paySuccessMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{paySuccessMsg}</span>
            </div>
          )}

          {/* Inline Record Payment Form */}
          {showPaymentForm && (
            <div className="p-3 bg-[var(--surface)] border border-[var(--accent)]/40 rounded-lg space-y-2.5 text-xs shadow-sm">
              <div className="flex items-center justify-between font-bold text-[var(--text)] pb-1 border-b border-[var(--border)]">
                <span className="flex items-center gap-1.5 text-[var(--accent)]">
                  <Wallet className="w-4 h-4" />
                  Record Customer Direct Payment
                </span>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text)] text-sm px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {payError && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-[var(--status-red)] text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">
                    Payment Amount (৳) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={remainingDue}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] font-num font-bold text-sm"
                  />
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Remaining due: ৳{remainingDue.toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">
                    Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => {
                      const m = e.target.value as any;
                      setPayMethod(m);
                      if (m === 'bkash') setPayAccount('acc_bkash');
                      else if (m === 'nagad') setPayAccount('acc_nagad');
                      else if (m === 'bank') setPayAccount('acc_bank');
                      else if (m === 'cash') setPayAccount('acc_cash');
                    }}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] font-medium"
                  >
                    <option value="bkash">bKash Merchant</option>
                    <option value="nagad">Nagad Merchant</option>
                    <option value="bank">City Bank Account</option>
                    <option value="cash">Cash / Direct</option>
                    <option value="card">Card POS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">
                    Deposit Account *
                  </label>
                  <select
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] font-medium"
                  >
                    {accounts
                      .filter(
                        (a) =>
                          a.type === 'asset' &&
                          (a.id.includes('bank') ||
                            a.id.includes('bkash') ||
                            a.id.includes('nagad') ||
                            a.id.includes('cash'))
                      )
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">
                    TrxID / Reference (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. bKash TrxID or Bank Slip #"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Partial advance paid before delivery"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)]"
                  />
                </div>
              </div>

              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <span>
                  Posting debits the selected account, credits <strong>Courier Receivable (1100)</strong>, and automatically lowers Steadfast COD expected from the rider to ৳{Math.max(0, (linkedBooking ? (linkedBooking.cod_amount ?? 0) : remainingDue) - payAmount).toLocaleString()}.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordPaymentSubmit}
                  disabled={isSubmittingPay || payAmount <= 0 || payAmount > remainingDue}
                  className="px-4 py-1.5 rounded bg-[var(--accent)] text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingPay ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Confirm &amp; Post ৳{payAmount.toLocaleString()}</span>
                </button>
              </div>
            </div>
          )}

          {/* Transactions Table */}
          {payments.length > 0 && (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs">
              <table className="dense-table">
                <thead>
                  <tr>
                    <th>Type / Method</th>
                    <th>Account</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th>Ref / Recorded By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={i} className={p.method === 'cod_pending' ? 'bg-amber-500/5' : ''}>
                      <td className="font-medium text-[var(--text)]">
                        <span className="capitalize">{paymentMethodLabel(p.method)}</span>
                        {p.method === 'cod_pending' && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                            Rider Collection
                          </span>
                        )}
                      </td>
                      <td className="text-[var(--text-secondary)]">{paymentAccountLabel(p.payment_account_id)}</td>
                      <td className="text-right font-num font-semibold text-[var(--text)]">
                        ৳{p.amount.toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            p.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : p.status === 'refunded'
                              ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="text-[var(--text-secondary)]">
                        {p.transaction_ref ? <span className="font-mono">{p.transaction_ref} · </span> : ''}
                        {p.received_by}
                      </td>
                      <td className="text-[var(--text-secondary)]">
                        {new Date(p.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
