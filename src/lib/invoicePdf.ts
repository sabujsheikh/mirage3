import { jsPDF } from 'jspdf';
import { Order } from '../types';

// Section 9: invoices are generated as a proper A4 PDF (black & white),
// not a raw browser print of an HTML page.
interface InvoicePdfOptions {
  business_name: string;
  business_phone?: string;
  business_address?: string;
}

export function generateInvoicePdf(
  order: Order,
  opts: InvoicePdfOptions,
  fileName = `Invoice-${order.invoice_number}.pdf`
): void {
  if (order.order_type === 'merchant_fulfillment') {
    alert('Customer invoices are not generated for Dropship Fulfillment orders. Please print the 100x100mm Dropship Sticker.');
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const BLACK: [number, number, number] = [0, 0, 0];
  const isWholesale = order.sale_type === 'wholesale';

  // Header: brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(opts.business_name.toUpperCase(), margin, margin + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(opts.business_address || '', margin, margin + 12);
  doc.text(`Tel: ${opts.business_phone || ''}`, margin, margin + 17);

  // Wholesale indicator (Point 4)
  if (isWholesale) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('WHOLESALE SUPPLY INVOICE', pageW / 2, margin + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  }

  // Order barcode code (rendered as scannable code text)
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(`*${order.order_barcode}*`, pageW - margin, margin + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.6);
  doc.line(margin, margin + 22, pageW - margin, margin + 22);

  // FROM / BILL TO
  let y = margin + 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('FROM:', margin, y);
  doc.text('BILL TO:', pageW / 2 + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(opts.business_name, margin, y + 5);
  doc.text(`${order.customer_name}`, pageW / 2 + 4, y + 5);
  doc.setFontSize(8);
  doc.text(`Fulfillment: ${(order.fulfillment_method || '').replace('_', ' ').toUpperCase()}`, margin, y + 10);
  doc.text(`Phone: ${order.customer_phone}`, pageW / 2 + 4, y + 10);
  if (order.delivery_address_text) {
    const addr = doc.splitTextToSize(order.delivery_address_text, contentW / 2 - 6);
    doc.text(addr, pageW / 2 + 4, y + 15);
  }

  // Invoice meta bar
  y = margin + 50;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setDrawColor(...BLACK);
  doc.rect(margin, y, contentW, 8, 'S');
  doc.setFontSize(8);
  doc.text(`INVOICE NO: ${order.invoice_number}`, margin + 3, y + 6);
  doc.text(`DATE: ${new Date(order.created_at).toLocaleDateString('en-GB')}`, pageW / 2 - 20, y + 6);
  doc.text(`STATUS: ${(order.status || '').toUpperCase()}`, pageW - margin - 8, y + 6, { align: 'right' });

  // Items table
  y += 14;
  const colX = [margin, margin + 22, margin + contentW - 52, margin + contentW - 28, margin + contentW - 8];
  doc.setFillColor(245, 245, 245);
  doc.rect(colX[0], y, contentW, 7, 'F');
  doc.setDrawColor(...BLACK);
  doc.rect(colX[0], y, contentW, 7, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CODE', colX[0] + 2, y + 4.5);
  doc.text('ITEM NAME', colX[1] + 2, y + 4.5);
  doc.text('QTY', colX[2] + 2, y + 4.5);
  doc.text('PRICE', colX[3] - 2, y + 4.5, { align: 'right' });
  doc.text('TOTAL', colX[4] - 2, y + 4.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  let rowY = y + 7;
  order.items.forEach((item) => {
    const lineTotal = (item.unit_price - (item.discount_amount || 0)) * item.quantity;
    // Manual black & white row borders per line
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.2);
    doc.rect(colX[0], rowY, contentW, 7, 'S');
    doc.setFontSize(8);
    doc.text(item.sku || '', colX[0] + 2, rowY + 4.5);
    doc.text(String(item.product_name), colX[1] + 2, rowY + 4.5);
    doc.text(String(item.quantity), colX[2] + 2, rowY + 4.5);
    doc.text(`\u09F3${item.unit_price.toLocaleString()}`, colX[3] - 2, rowY + 4.5, { align: 'right' });
    if ((item.discount_amount || 0) > 0) {
      doc.setFontSize(7);
      doc.text(`(disc -\u09F3${item.discount_amount.toLocaleString()})`, colX[4] - 2, rowY + 4.5, { align: 'right' });
      doc.setFontSize(8);
    }
    doc.text(`\u09F3${lineTotal.toLocaleString()}`, colX[4] - 2, rowY + 9.5, { align: 'right' });
    rowY += 7;
  });

  // Totals
  rowY += 3;
  const totalX = pageW / 2 + 4;
  doc.setFontSize(8);
  doc.text(`SUBTOTAL`, totalX, rowY);
  doc.text(`\u09F3${order.subtotal.toLocaleString()}`, pageW - margin, rowY, { align: 'right' });
  rowY += 5;
  if (order.delivery_charge > 0) {
    doc.text(`DELIVERY CHARGE`, totalX, rowY);
    doc.text(`\u09F3${order.delivery_charge.toLocaleString()}`, pageW - margin, rowY, { align: 'right' });
    rowY += 5;
  }
  if ((order.discount_amount || 0) > 0) {
    doc.text(`DISCOUNT`, totalX, rowY);
    doc.text(`-\u09F3${order.discount_amount.toLocaleString()}`, pageW - margin, rowY, { align: 'right' });
    rowY += 5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setFillColor(245, 245, 245);
  doc.rect(totalX - 2, rowY - 4, contentW - (totalX - 2 - margin), 7, 'F');
  doc.text('TOTAL DUE', totalX, rowY + 0.5);
  doc.text(`\u09F3${order.total.toLocaleString()}`, pageW - margin, rowY + 0.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  // Special Instructions / Invoice Note (Section 3.2)
  if (order.invoice_note) {
    const noteY = Math.max(rowY + 12, 235);
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.rect(margin, noteY, contentW, 20, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('SPECIAL INSTRUCTIONS / PARCEL NOTE:', margin + 3, noteY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const splitNote = doc.splitTextToSize(order.invoice_note, contentW - 6);
    doc.text(splitNote, margin + 3, noteY + 10);
  }

  // Footer
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.6);
  doc.line(margin, 282, pageW - margin, 282);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('This is a system-generated invoice. No signature is required.', pageW / 2, 288, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(
    isWholesale
      ? 'Wholesale price invoice \u2014 Thank you for partnering with Mirage Perfume.'
      : 'Thank you for choosing Mirage Perfume \u2014 Authentic Branded Fragrances.',
    pageW / 2,
    293,
    { align: 'center' }
  );

  doc.save(fileName);
}
