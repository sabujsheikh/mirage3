import React from 'react';
import { Printer, X, Download, Sparkles } from 'lucide-react';
import { Order } from '../../types';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { useApp } from '../../context/AppContext';
import { generateInvoicePdf } from '../../lib/invoicePdf';

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, isOpen, onClose }) => {
  const { settings } = useApp();

  if (!isOpen || !order) return null;

  if (order.order_type === 'merchant_fulfillment') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--accent-rgb),0.10)] p-4 overflow-y-auto">
        <div className="bg-[var(--card)] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border)] space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text)]">Merchant Dropship Order</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Per the Dropship Fulfillment workflow, customer invoices are not printed for these orders. Only the external 100×100mm Dropship Parcel Sticker is used.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const businessName = settings?.business_name || 'MIRAGE PERFUME BANGLADESH';
  const businessPhone = settings?.phone || '+8801999033027';
  const businessAddress = settings?.address || 'House 47, Road 27, Banani, Dhaka, Bangladesh';
  const isWholesale = order.sale_type === 'wholesale';

  const handlePrint = () => {
    // Section 9: proper A4 PDF, not a raw browser print
    generateInvoicePdf(
      order,
      { business_name: businessName, business_phone: businessPhone, business_address: businessAddress }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--accent-rgb),0.10)] p-4 overflow-y-auto">
      {/* Modal Card */}
      <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden border border-[var(--border)] flex flex-col max-h-[90vh]">
        {/* Top Control Bar */}
        <div className="p-4 bg-[var(--accent)] text-white flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight">
              {isWholesale ? 'Wholesale Invoice: ' : 'Customer Invoice: '}{order.invoice_number}
            </h3>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[var(--card)]/20">
              {order.channel}
            </span>
            {isWholesale && (
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[var(--accent-secondary)]">
                Wholesale
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/90 text-white text-xs font-bold rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Download A4 Invoice PDF</span>
            </button>

            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Black & White A4 Document View (Section 9) */}
        <div className="flex-1 overflow-y-auto p-8 bg-[var(--card)] text-[var(--text)]">
          {/* Printable Invoice Container */}
          <div className="border border-[var(--text)] p-8 max-w-2xl mx-auto space-y-6 text-[var(--text)]">
            {/* Header: Brand & Order Barcode */}
            <div className="flex items-start justify-between border-b-2 border-[var(--text)] pb-6">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--text)] uppercase">
                  {businessName}
                </h1>
                <p className="text-xs text-[var(--text)] mt-1">{businessAddress}</p>
                <p className="text-xs text-[var(--text)]">Tel: {businessPhone} | Web: mirageperfume.com</p>
              </div>

              {/* Order Barcode (Section 9, 41.2 Code128) */}
              <div className="text-right flex flex-col items-end">
                <BarcodeSvg value={order.order_barcode} height={42} width={1.5} displayValue={false} />
                <span className="text-[10px] font-mono tracking-widest mt-0.5">{order.order_barcode}</span>
              </div>
            </div>

            {/* Wholesale header line (Point 4) */}
            {isWholesale && (
              <div className="flex items-center justify-center -mt-2">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] border-2 border-[var(--text)] px-3 py-1">
                  Wholesale Supply Invoice
                </span>
              </div>
            )}

            {/* Invoice Meta Grid */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              {/* FROM */}
              <div className="space-y-1">
                <div className="font-bold uppercase tracking-wider text-[10px] border-b border-[var(--text)] pb-0.5">
                  FROM:
                </div>
                <div className="font-bold">{businessName}</div>
                <div>Showroom: Banani, Dhaka</div>
                <div>Fulfillment: {order.fulfillment_method.replace('_', ' ').toUpperCase()}</div>
              </div>

              {/* BILL TO */}
              <div className="space-y-1">
                <div className="font-bold uppercase tracking-wider text-[10px] border-b border-[var(--text)] pb-0.5">
                  BILL TO:
                </div>
                <div className="font-bold">{order.customer_name}</div>
                <div className="font-mono">Phone: {order.customer_phone}</div>
                {order.delivery_address_text && (
                  <div className="text-xs leading-relaxed">{order.delivery_address_text}</div>
                )}
              </div>
            </div>

            {/* Invoice Number & Date Bar */}
            <div className="bg-[var(--surface-sunken)] border border-[var(--text)] p-2.5 flex items-center justify-between text-xs font-bold">
              <div>
                INVOICE NO: <span className="font-mono">{order.invoice_number}</span>
              </div>
              <div>
                DATE: <span className="font-mono">{new Date(order.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                SALE TYPE: <span className="uppercase">{isWholesale ? 'Wholesale' : 'Retail'}</span>
              </div>
              <div>
                STATUS: <span className="uppercase">{order.status}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-[var(--text)]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--text)] bg-[var(--surface-sunken)] font-bold text-[11px]">
                    <th className="p-2 border-r border-[var(--text)] w-16">CODE</th>
                    <th className="p-2 border-r border-[var(--text)]">ITEM NAME / DESCRIPTION</th>
                    <th className="p-2 border-r border-[var(--text)] text-center w-12">QTY</th>
                    <th className="p-2 border-r border-[var(--text)] text-right w-24">PRICE (BDT)</th>
                    <th className="p-2 border-r border-[var(--text)] text-right w-24">DISC (BDT)</th>
                    <th className="p-2 text-right w-28">TOTAL (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--text)]">
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border-r border-[var(--text)] font-num text-[11px]">{item.sku}</td>
                      <td className="p-2 border-r border-[var(--text)] font-semibold">{item.product_name}</td>
                      <td className="p-2 border-r border-[var(--text)] text-center font-num">{item.quantity}</td>
                      <td className="p-2 border-r border-[var(--text)] text-right font-num">
                        &#2547;{item.unit_price.toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-[var(--text)] text-right font-num">
                        {item.discount_amount > 0 ? (
                          <span className="text-[var(--status-red)]">-&#2547;{item.discount_amount.toLocaleString()}</span>
                        ) : (
                          <span className="text-[var(--text-secondary)]">&#8212;</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-num font-bold">
                        &#2547;{((item.unit_price - item.discount_amount) * item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Payment Breakdown */}
            <div className="grid grid-cols-2 gap-6 text-xs pt-2">
              {/* Payment Details */}
              <div className="border border-[var(--text)] p-3 space-y-1">
                <div className="font-bold text-[10px] uppercase border-b border-[var(--text)] pb-1">
                  PAYMENT INFORMATION
                </div>
                <div>Method: <strong className="uppercase">{order.payments?.[0]?.method || 'Cash on Delivery'}</strong></div>
                {order.payments?.[0]?.transaction_ref && (
                  <div>Trx ID: <span className="font-num">{order.payments[0].transaction_ref}</span></div>
                )}
                <div>Payment Status: <strong className="uppercase">{order.payments?.[0]?.status || 'Pending'}</strong></div>
                <div>Issued By: {order.created_by_name}</div>
              </div>

              {/* Totals Table */}
              <div className="border border-[var(--text)] divide-y divide-[var(--text)]">
                <div className="p-2 flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-num font-semibold">&#2547;{order.subtotal.toLocaleString()}</span>
                </div>
                {order.delivery_charge > 0 && (
                  <div className="p-2 flex justify-between">
                    <span>Delivery Charge:</span>
                    <span className="font-num font-semibold">&#2547;{order.delivery_charge.toLocaleString()}</span>
                  </div>
                )}
                {order.discount_amount > 0 && (
                  <div className="p-2 flex justify-between text-[var(--text)]">
                    <span>Discount:</span>
                    <span className="font-num font-semibold">-&#2547;{order.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="p-2 bg-[var(--surface-sunken)] flex justify-between font-bold text-sm">
                  <span>TOTAL DUE:</span>
                  <span className="font-num">&#2547;{order.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Special Instructions / Invoice Note (Section 3.2) */}
            {order.invoice_note && (
              <div className="border border-[var(--text)] p-3 text-xs bg-[var(--surface-sunken)] space-y-1">
                <div className="font-bold text-[10px] uppercase border-b border-[var(--text)] pb-0.5">
                  SPECIAL INSTRUCTIONS / PARCEL NOTE
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-[11px] font-medium">{order.invoice_note}</p>
              </div>
            )}

            {/* Footer Notes (Section 9) */}
            <div className="border-t border-[var(--text)] pt-4 text-center text-[10px] text-[var(--text)] space-y-1">
              <p className="font-semibold">This is a system-generated invoice. No signature is required.</p>
              {isWholesale ? (
                <p>Wholesale price invoice &#8212; Thank you for partnering with Mirage Perfume.</p>
              ) : (
                <p>Thank you for choosing Mirage Perfume &#8212; Authentic Branded Fragrances.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
