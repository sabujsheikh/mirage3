import { jsPDF } from 'jspdf';
import { Order } from '../types';

interface AddressStickerOptions {
  business_name?: string;
  business_phone?: string;
}

export function generateAddressStickerPdf(
  order: Order,
  opts: AddressStickerOptions = {},
  fileName = `Address-Sticker-${order.invoice_number}.pdf`
): void {
  if (order.fulfillment_method !== 'instant_delivery') {
    alert('Address stickers are only available for Instant Delivery orders.');
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: [100, 70] });
  const margin = 7;
  const width = 100;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(opts.business_name || 'Mirage Perfume Bangladesh', margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Instant Delivery${order.instant_delivery_provider ? ` \u2022 ${order.instant_delivery_provider.toUpperCase()}` : ''}`, margin, 16);
  if (opts.business_phone) doc.text(`Hotline: ${opts.business_phone}`, width - margin, 16, { align: 'right' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, 20, width - margin, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DELIVER TO', margin, 28);
  doc.setFontSize(16);
  doc.text(order.customer_name || 'Customer', margin, 36);
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text(order.customer_phone || '', margin, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const address = doc.splitTextToSize(order.delivery_address_text || 'Address not provided', width - margin * 2);
  doc.text(address, margin, 52);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Order: ${order.invoice_number}`, width - margin, 66, { align: 'right' });
  doc.save(fileName);
}
