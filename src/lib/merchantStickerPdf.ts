import { jsPDF } from 'jspdf';
import { Order } from '../types';

/**
 * Generates a thermal sticker PDF for Dropship Fulfillment orders.
 *
 * Requirements:
 * Sized for standard thermal label printers (100mm x 100mm).
 * Sticker must contain ONLY the available:
 * - Merchant / Company Name
 * - Merchant ID
 * - Parcel ID
 * - Customer Name
 *
 * MUST NOT contain:
 * - Product name
 * - SKU
 * - Product price
 * - Cost price
 * - Product contents
 * - Internal accounting information
 */
export function generateMerchantStickerPdf(
  order: Order,
  fileName = `MerchantSticker-${order.parcel_id || order.invoice_number}.pdf`
): void {
  const doc = new jsPDF({ unit: 'mm', format: [100, 100] });
  const pageW = 100;
  const pageH = 100;
  const margin = 6;
  const contentW = pageW - margin * 2;

  const setBold = (size: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
  };
  const setNorm = (size: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
  };

  // Outer border for 100x100mm thermal sticker
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(margin, margin, contentW, pageH - margin * 2);

  let y = margin + 5;

  // Header Banner
  setBold(11);
  doc.text('DROPSHIP FULFILLMENT', pageW / 2, y, { align: 'center' });
  y += 4.5;
  setNorm(7);
  doc.text('PARCEL IDENTIFICATION LABEL', pageW / 2, y, { align: 'center' });
  y += 4;

  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Available Merchant / Company Name
  if (order.merchant_name && order.merchant_name.trim()) {
    setNorm(7);
    doc.text('MERCHANT / COMPANY NAME:', margin + 3, y);
    y += 4.5;
    setBold(11);
    const mName = doc.splitTextToSize(order.merchant_name.trim().toUpperCase(), contentW - 6);
    doc.text(mName, margin + 3, y);
    y += mName.length * 4.5 + 2;

    doc.setLineWidth(0.3);
    doc.line(margin + 3, y, pageW - margin - 3, y);
    y += 4;
  }

  // Available Merchant ID
  if (order.merchant_id && order.merchant_id.trim()) {
    setNorm(7);
    doc.text('MERCHANT ID:', margin + 3, y);
    y += 4.5;
    setBold(10);
    doc.text(order.merchant_id.trim(), margin + 3, y);
    y += 5.5;

    doc.setLineWidth(0.3);
    doc.line(margin + 3, y, pageW - margin - 3, y);
    y += 4;
  }

  // Available Parcel ID (with prominent Code128 representation)
  if (order.parcel_id && order.parcel_id.trim()) {
    setNorm(7);
    doc.text('PARCEL ID:', margin + 3, y);
    y += 4.5;

    // Center-aligned barcode representation
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(`*${order.parcel_id.trim()}*`, pageW / 2, y, { align: 'center' });
    y += 4.5;

    setBold(11);
    doc.text(order.parcel_id.trim(), pageW / 2, y, { align: 'center' });
    y += 5.5;

    doc.setLineWidth(0.3);
    doc.line(margin + 3, y, pageW - margin - 3, y);
    y += 4;
  }

  // Customer Name (End Customer Name)
  const customerName = order.end_customer_name || order.customer_name;
  if (customerName && customerName.trim()) {
    setNorm(7);
    doc.text('END CUSTOMER NAME:', margin + 3, y);
    y += 4.5;
    setBold(11);
    const cName = doc.splitTextToSize(customerName.trim().toUpperCase(), contentW - 6);
    doc.text(cName, margin + 3, y);
    y += cName.length * 4.5 + 2;
  }

  // Footer / Disclaimer
  setNorm(6);
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Parcel Identification Label Only \u2022 Does Not Replace Invoice/Packing Documents',
    pageW / 2,
    pageH - margin - 2.5,
    { align: 'center' }
  );

  doc.save(fileName);
}
