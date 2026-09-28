import { jsPDF } from 'jspdf';
import { Order, CourierBooking } from '../types';

export function generateOrderSheetPdf(
  orders: Order[],
  courierBookings: CourierBooking[] = [],
  title = "Today's Order Summary Sheet"
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const margin = 12;
  let y = margin;

  // Header Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MIRAGE PERFUME BANGLADESH', margin, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('House 47, Road 27, Banani, Dhaka \u2022 Hotline: +8801999033027', margin, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), pageW - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Printed on: ${new Date().toLocaleString('en-GB')} \u2022 Total Orders: ${orders.length}`,
    pageW - margin,
    y + 9,
    { align: 'right' }
  );

  y += 14;
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Summary Metrics Banner
  const totalAmount = orders.reduce((sum, o) => sum + o.total, 0);
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((isum, it) => isum + it.quantity, 0), 0);
  const steadfastCount = orders.filter((o) => o.fulfillment_method === 'steadfast').length;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, pageW - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`SELECTED ORDERS: ${orders.length}`, margin + 3, y + 5.5);
  doc.text(`TOTAL BOTTLES: ${totalItems} Units`, margin + 60, y + 5.5);
  doc.text(`TOTAL VALUE: BDT ${totalAmount.toLocaleString()}`, margin + 125, y + 5.5);
  doc.text(`STEADFAST COD ORDERS: ${steadfastCount}`, margin + 200, y + 5.5);

  y += 12;

  // Table Columns Setup
  const headers = ['#', 'Invoice #', 'Customer & Contact', 'Destination Address', 'Order Items', 'Fulfillment', 'Consignment / Code', 'Total (BDT)'];
  const colX = [margin, margin + 8, margin + 35, margin + 85, margin + 155, margin + 215, margin + 242, pageW - margin];

  doc.setFillColor(22, 50, 79);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  doc.text(headers[0], colX[0] + 2, y + 4.8);
  doc.text(headers[1], colX[1], y + 4.8);
  doc.text(headers[2], colX[2], y + 4.8);
  doc.text(headers[3], colX[3], y + 4.8);
  doc.text(headers[4], colX[4], y + 4.8);
  doc.text(headers[5], colX[5], y + 4.8);
  doc.text(headers[6], colX[6], y + 4.8);
  doc.text(headers[7], colX[7] - 2, y + 4.8, { align: 'right' });

  y += 7;
  doc.setTextColor(30, 30, 30);

  orders.forEach((order, idx) => {
    if (y > pageH - 25) {
      doc.addPage();
      y = margin;
    }

    const booking = courierBookings.find((b) => b.order_id === order.id);
    const tracking = order.courier_tracking_code || booking?.consignment_no || '\u2014';
    const itemsSummary = order.items.map((i) => `${i.product_name} (x${i.quantity})`).join(', ');

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageW - margin * 2, 6.5, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    doc.text(String(idx + 1), colX[0] + 2, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(order.invoice_number, colX[1], y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${order.customer_name} (${order.customer_phone})`.slice(0, 28), colX[2], y + 4.5);
    doc.text((order.delivery_address_text || 'In-store').slice(0, 42), colX[3], y + 4.5);
    doc.text(itemsSummary.slice(0, 38), colX[4], y + 4.5);
    doc.text(order.fulfillment_method.replace('_', ' ').toUpperCase().slice(0, 14), colX[5], y + 4.5);
    doc.text(tracking.slice(0, 18), colX[6], y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(order.total.toLocaleString(), colX[7] - 2, y + 4.5, { align: 'right' });

    y += 6.5;
  });

  // Bottom Handover Sign-off
  if (y > pageH - 25) {
    doc.addPage();
    y = margin;
  }
  y += 8;
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('PREPARED BY (PACKING TEAM): ___________________________', margin + 5, y + 4);
  doc.text('DISPATCH COURIER RIDER SIGNATURE: ___________________________', margin + 140, y + 4);

  doc.save(`Order-Summary-Sheet-${new Date().toISOString().slice(0, 10)}.pdf`);
}
