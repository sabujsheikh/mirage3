import React from 'react';
import { MapPin, Printer, X, Truck } from 'lucide-react';
import { Order } from '../../types';
import { useApp } from '../../context/AppContext';
import { generateAddressStickerPdf } from '../../lib/addressStickerPdf';

interface AddressStickerModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const AddressStickerModal: React.FC<AddressStickerModalProps> = ({ order, isOpen, onClose }) => {
  const { settings } = useApp();
  if (!isOpen) return null;

  const handlePrint = () => {
    generateAddressStickerPdf(order, {
      business_name: settings?.business_name,
      business_phone: settings?.phone,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-md w-full border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--accent)] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[var(--accent-secondary)]" />
            <h3 className="text-sm font-bold">Instant Delivery Address Sticker</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 bg-[var(--surface-sunken)] flex justify-center">
          <div className="bg-white text-black w-full max-w-[360px] aspect-[10/7] border-2 border-black p-5 shadow-md">
            <div className="font-bold text-sm border-b border-black pb-2">{settings?.business_name || 'Mirage Perfume Bangladesh'}</div>
            <div className="text-[10px] font-bold mt-4 uppercase">Deliver To</div>
            <div className="font-black text-xl mt-1">{order.customer_name}</div>
            <div className="font-mono font-bold text-base mt-2">{order.customer_phone}</div>
            <div className="text-sm font-semibold mt-2 leading-relaxed">{order.delivery_address_text || 'Address not provided'}</div>
            <div className="text-[10px] font-mono mt-4">{order.invoice_number} &#8226; {order.instant_delivery_provider?.toUpperCase() || 'Instant Delivery'}</div>
          </div>
        </div>
        <div className="p-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold border border-[var(--border)] rounded-lg cursor-pointer">Close</button>
          <button type="button" onClick={handlePrint} className="px-3 py-2 text-xs font-bold bg-[var(--accent)] text-white rounded-lg flex items-center gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print Address Sticker
          </button>
        </div>
      </div>
    </div>
  );
};
