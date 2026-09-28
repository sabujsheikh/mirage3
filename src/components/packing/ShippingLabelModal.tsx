import React from 'react';
import { Printer, X, Download, ShieldCheck, Truck, Package, AlertTriangle } from 'lucide-react';
import { Order } from '../../types';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { useApp } from '../../context/AppContext';
import { generateShippingLabelPdf } from '../../lib/labelPdf';

interface ShippingLabelModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  // Called after the label PDF has been generated/printed, so the caller can
  // record the "label printed & attached" step server-side (Section 9/11).
  onPrint?: (order: Order) => void;
}

export const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({ order, isOpen, onClose, onPrint }) => {
  const { settings } = useApp();

  if (!isOpen) return null;

  const trackingCode = order.courier_tracking_code || `STF-${order.invoice_number.replace('INV-2026-', '')}`;

  const handlePrint = () => {
    // Section 9 \u2014 proper 4x6" thermal-label PDF, not a raw browser print
    generateShippingLabelPdf(
      order,
      { business_name: settings?.business_name, business_phone: settings?.phone }
    );
    if (onPrint) onPrint(order);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-xl w-full border border-[var(--border)] overflow-hidden my-8">
        {/* Modal Toolbar (hidden during print) */}
        <div className="bg-[var(--accent)] text-white p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--accent-secondary)]" />
            <h3 className="text-sm font-bold tracking-wide">
              Thermal Shipping Label & QA Packing Slip
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-[var(--accent-secondary)] hover:opacity-90 text-[var(--accent-contrast)] text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Download 4x6" Label PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Shipping Label Container (100mm x 150mm / 4x6" ratio) */}
        <div className="p-6 bg-[var(--surface-sunken)] flex justify-center">
          <div
            className="printable-document bg-white w-full max-w-[420px] border-2 border-black p-4 text-black font-sans leading-tight shadow-md"
            style={{ minHeight: '560px' }}
          >
            {/* Header: Courier & COD Banner */}
            <div className="border-b-2 border-black pb-3 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black tracking-widest uppercase flex items-center gap-1">
                    <Truck className="w-4 h-4 inline" /> STEADFAST COURIER
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                    Express Parcel Service
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Cash On Delivery</div>
                  <div className="text-xl font-black font-num">&#2547;{order.total.toLocaleString()}</div>
                </div>
              </div>

              {/* Tracking Barcode */}
              <div className="mt-2 text-center flex flex-col items-center bg-[var(--surface-sunken)] p-1 border border-black/30 rounded">
                <BarcodeSvg value={trackingCode} height={42} width={1.8} className="w-full max-w-[320px]" />
                <div className="text-[11px] font-mono font-bold tracking-widest mt-0.5">
                  TRACKING: {trackingCode}
                </div>
              </div>
            </div>

            {/* Recipient Details (Large, Bold for Courier Riders) */}
            <div className="border-b-2 border-black pb-3 mb-3">
              <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">
                DELIVER TO (RECIPIENT):
              </div>
              <div className="text-base font-black uppercase mt-1">{order.customer_name}</div>
              <div className="text-sm font-black font-mono mt-0.5 tracking-wider bg-black text-white px-2 py-0.5 inline-block rounded">
                PHONE: {order.customer_phone}
              </div>
              <div className="text-xs font-bold text-gray-900 mt-1.5 leading-relaxed bg-gray-100 p-2 rounded border border-gray-300">
                {order.delivery_address_text || 'Standard Courier Delivery Address'}
              </div>
            </div>

            {/* Sender / Return Details */}
            <div className="border-b-2 border-black pb-2 mb-2 text-[11px] flex justify-between">
              <div>
                <span className="font-black">FROM (RETURN SENDER):</span>
                <div className="font-bold">{settings?.business_name || 'Mirage Perfume Bangladesh'}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Police Plaza Concord, Gulshan-1, Dhaka</div>
                <div className="text-[10px] font-mono">Hotline: {settings?.phone || '01700000000'}</div>
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)]">INVOICE:</span>
                  <div className="font-mono font-black">{order.invoice_number}</div>
                </div>
                <div className="text-[10px] font-mono text-[var(--text-secondary)]">
                  {new Date(order.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>

            {/* Order Contents (SKU breakdown) */}
            <div className="border-b-2 border-black pb-2 mb-2">
              <div className="text-[10px] font-black uppercase text-[var(--text-secondary)] mb-1 flex justify-between">
                <span>PARCEL CONTENTS ({order.items.reduce((s, i) => s + i.quantity, 0)} ITEMS)</span>
                <span>QTY</span>
              </div>
              <div className="space-y-1 text-xs">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-[var(--border)] pb-1">
                    <div className="pr-2">
                      <span className="font-mono font-bold text-[11px] mr-1">[{item.sku}]</span>
                      <span className="font-medium text-[11px]">{item.product_name}</span>
                    </div>
                    <span className="font-mono font-bold text-xs shrink-0">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fragile Notice & Quality Check Verification Stamp */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 text-[11px] font-black text-red-600 border-2 border-red-600 px-2 py-1 rounded">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>FRAGILE / GLASS</span>
              </div>

              <div className="text-right text-[10px]">
                <div className="font-black text-green-800 flex items-center justify-end gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>QA VERIFIED & PACKED</span>
                </div>
                <div className="text-[var(--text-secondary)] font-mono">
                  {order.packed_by_name || 'Packing Staff'} &#8226; {order.package_weight_grams || 450}g
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--surface-sunken)] border-t border-[var(--border)] flex justify-between items-center no-print">
          <div className="text-xs text-[var(--text-secondary)]">
            Formatted for 4x6" thermal label & standard desktop printers.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold rounded hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
