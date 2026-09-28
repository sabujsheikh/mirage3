import React from 'react';
import { Printer, X, Tag, ShieldAlert } from 'lucide-react';
import { Order } from '../../types';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { generateMerchantStickerPdf } from '../../lib/merchantStickerPdf';

interface MerchantStickerModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MerchantStickerModal: React.FC<MerchantStickerModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    generateMerchantStickerPdf(order);
  };

  const customerName = order.end_customer_name || order.customer_name;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-md w-full border border-[var(--border)] overflow-hidden my-8">
        {/* Header Toolbar */}
        <div className="bg-[var(--accent)] text-white p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[var(--accent-secondary)]" />
            <div>
              <h3 className="text-sm font-bold tracking-wide">
                Dropship Fulfillment Sticker
              </h3>
              <p className="text-[11px] text-white/80">
                Thermal parcel label for dropship order
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[var(--accent-secondary)] hover:opacity-90 text-[var(--accent-contrast)] text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Download Thermal PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Privacy Note Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Privacy Enforced: Contains only merchant & parcel identifiers. Product names, SKUs, and pricing are hidden.</span>
        </div>

        {/* Thermal Sticker Preview (100mm x 100mm aspect ratio) */}
        <div className="p-6 bg-[var(--surface-sunken)] flex justify-center">
          <div
            className="printable-document bg-white w-full max-w-[340px] aspect-square border-2 border-black p-4 text-black font-sans flex flex-col justify-between shadow-md"
          >
            {/* Header */}
            <div>
              <div className="border-b-2 border-black pb-2 mb-3 text-center">
                <div className="text-xs font-black tracking-widest uppercase">
                  DROPSHIP FULFILLMENT
                </div>
                <div className="text-[9px] font-mono uppercase text-gray-600 mt-0.5 tracking-wider">
                  PARCEL IDENTIFICATION LABEL
                </div>
              </div>

              {/* Available Fields */}
              <div className="space-y-2.5 text-xs">
                {order.merchant_name && (
                  <div className="border-b border-gray-300 pb-2">
                    <div className="text-[9px] font-bold uppercase text-gray-500 tracking-wider">
                      Merchant / Company:
                    </div>
                    <div className="text-sm font-black uppercase text-black mt-0.5">
                      {order.merchant_name}
                    </div>
                  </div>
                )}

                {order.merchant_id && (
                  <div className="border-b border-gray-300 pb-2">
                    <div className="text-[9px] font-bold uppercase text-gray-500 tracking-wider">
                      Merchant ID:
                    </div>
                    <div className="text-xs font-black font-mono text-black mt-0.5">
                      {order.merchant_id}
                    </div>
                  </div>
                )}

                {order.parcel_id && (
                  <div className="border-b border-gray-300 pb-2 text-center bg-gray-50 p-1.5 rounded border border-gray-200">
                    <div className="text-[9px] font-bold uppercase text-gray-500 tracking-wider text-left">
                      Parcel ID:
                    </div>
                    <div className="flex justify-center my-1">
                      <BarcodeSvg
                        value={order.parcel_id}
                        height={36}
                        width={1.4}
                        className="w-full max-w-[240px]"
                      />
                    </div>
                    <div className="text-xs font-black font-mono tracking-widest">
                      {order.parcel_id}
                    </div>
                  </div>
                )}

                {customerName && (
                  <div>
                    <div className="text-[9px] font-bold uppercase text-gray-500 tracking-wider">
                      Customer Name:
                    </div>
                    <div className="text-sm font-black uppercase text-black mt-0.5">
                      {customerName}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-gray-300 text-center">
              <div className="text-[8px] font-mono text-gray-500 uppercase tracking-tight">
                Parcel ID Label &#8226; Does not replace invoice / packing slip
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[var(--card)] border-t border-[var(--border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-xs font-semibold rounded hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded flex items-center gap-1.5 hover:opacity-90 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print 100x100mm Sticker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
