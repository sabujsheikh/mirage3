import { jsPDF } from 'jspdf';
import { Order } from '../types';

// Section 9 / 41.2: courier sticker/label is sized for a standard thermal
// label printer \u2014 100mm x 150mm (4" x 6") \u2014 generated as a proper PDF.
interface LabelPdfOptions {
  business_name?: string;
  business_phone?: string;
}

export function generateShippingLabelPdf(
  order: Order,
  opts: LabelPdfOptions = {},
  fileName = `Label-${order.invoice_number}.pdf`
): void {
  const doc = new jsPDF({ unit: 'mm', format: [100, 150] });
  const pageW = 100;
  const margin = 5;
  const BW: [number, number, number] = [0, 0, 0];

  const trackingCode =
    order.courier_tracking_code || `STF-${order.invoice_number.replace('INV-', '')}`;

  let y = margin;
  const setBold = (size: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
  };
  const setNorm = (size: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
  };

  // Header: courier + COD
  setBold(9);
  doc.text('STEADFAST COURIER', margin, y + 4);
  setNorm(6);
  doc.text('Express Parcel Service', margin, y + 9);
  setBold(12);
  doc.text(`\u09F3${order.total.toLocaleString()}`, pageW - margin, y + 6, { align: 'right' });
  doc.text('CASH ON DELIVERY', pageW - margin, y + 10, { align: 'right' });
  doc.setDrawColor(...BW);
  doc.setLineWidth(0.6);
  y += 13;
  doc.line(margin, y, pageW - margin, y);

  // Tracking barcode (code128 text representation)
  y += 4;
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text(`*${trackingCode}*`, pageW / 2, y, { align: 'center' });
  setNorm(7);
  doc.text(`TRACKING: ${trackingCode}`, pageW / 2, y + 4, { align: 'center' });
  y += 8;
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);

  // Recipient
  y += 4;
  setNorm(6);
  doc.text('DELIVER TO (RECIPIENT):', margin, y);
  setBold(10);
  doc.text((order.customer_name || '').toUpperCase(), margin, y + 6);
  setBold(8);
  doc.text(`PHONE: ${order.customer_phone}`, margin, y + 11);
  const addr = doc.splitTextToSize(order.delivery_address_text || 'Standard Courier Delivery Address', pageW - margin * 2);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y + 14, pageW - margin * 2, addr.length * 3.5 + 3, 'F');
  setNorm(7);
  doc.text(addr, margin + 1.5, y + 16);
  y += 15 + addr.length * 3.5 + 2;

  // Sender / invoice
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  setNorm(6);
  doc.text('FROM (RETURN SENDER):', margin, y);
  setBold(8);
  doc.text(opts.business_name || 'Mirage Perfume Bangladesh', margin, y + 5);
  setNorm(6);
  doc.text(`Hotline: ${opts.business_phone || ''}`, margin, y + 9);
  doc.text('INVOICE:', pageW - margin, y, { align: 'right' });
  setBold(7);
  doc.text(order.invoice_number, pageW - margin, y + 4, { align: 'right' });
  setNorm(6);
  doc.text(new Date(order.created_at).toLocaleDateString('en-GB'), pageW - margin, y + 8, { align: 'right' });

  // Contents
  y += 13;
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  setBold(7);
  doc.text(`PARCEL CONTENTS (${order.items.reduce((s, i) => s + i.quantity, 0)} ITEMS)`, margin, y);
  y += 4;
  setNorm(6);
  let itemY = y;
  order.items.forEach((item) => {
    doc.text(`[${item.sku}] ${item.product_name}`, margin, itemY);
    doc.text(`x${item.quantity}`, pageW - margin, itemY, { align: 'right' });
    itemY += 4;
  });
  y = itemY + 3;

  // Fragile + QA stamp
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  setBold(8);
  doc.setTextColor(200, 30, 30);
  doc.text('FRAGILE / GLASS', margin, y);
  doc.setTextColor(0, 0, 0);
  doc.text('QA VERIFIED & PACKED', pageW - margin, y, { align: 'right' });
  setNorm(6);
  doc.text(`${order.packed_by_name || 'Packing Staff'} \u2022 ${order.package_weight_grams || 450}g`, pageW - margin, y + 4, { align: 'right' });

  doc.save(fileName);
}
