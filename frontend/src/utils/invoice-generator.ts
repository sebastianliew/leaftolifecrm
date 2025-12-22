"use client"

import type { Transaction } from "@/types/transaction"
import { jsPDF } from "jspdf"

// Company information
const defaultCompanyInfo = {
  name: "Sebastian Liew Centre Ltd.",
  address: {
    street: "320 Serangoon Road, Centrium square, #11-10",
    city: "Singapore",
    state: "",
    postalCode: "218108"
  },
  phone: "+65 6538 9978",
  email: "customerservice@leaftolife.com.sg",
  website: "www.leaftolife.com.sg"
}

// Generate and download invoice PDF directly in browser
export function generateInvoicePDF(transaction: Transaction): void {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    // Colors matching the HTML design
    const black = [0, 0, 0] as [number, number, number];
    const darkGray = [55, 65, 81] as [number, number, number];
    const gray = [107, 114, 128] as [number, number, number];
    const lightGray = [249, 250, 251] as [number, number, number];
    const green = [5, 150, 105] as [number, number, number];
    const red = [220, 38, 38] as [number, number, number];

    // HEADER SECTION
    // Company info (left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...black);
    doc.text(defaultCompanyInfo.name, margin, yPos);

    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text(defaultCompanyInfo.address.street, margin, yPos);
    yPos += 4;
    doc.text(`${defaultCompanyInfo.address.city}, ${defaultCompanyInfo.address.postalCode}`, margin, yPos);
    yPos += 4;
    doc.text(`Phone: ${defaultCompanyInfo.phone}`, margin, yPos);
    yPos += 4;
    doc.text(`Email: ${defaultCompanyInfo.email}`, margin, yPos);
    yPos += 4;
    if (defaultCompanyInfo.website) {
      doc.text(`Website: ${defaultCompanyInfo.website}`, margin, yPos);
    }

    // Invoice title and details (right)
    const rightX = pageWidth - margin;
    let rightYPos = margin;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(22);
    doc.setTextColor(...darkGray);
    doc.text("INVOICE", rightX, rightYPos, { align: "right" });

    rightYPos += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);

    doc.setFont("helvetica", "bold");
    doc.text("Invoice #: ", rightX - 50, rightYPos, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(transaction.invoiceNumber || transaction.transactionNumber, rightX, rightYPos, { align: "right" });

    rightYPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Date: ", rightX - 50, rightYPos, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(new Date(transaction.transactionDate).toLocaleDateString('en-GB'), rightX, rightYPos, { align: "right" });

    rightYPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Due Date: ", rightX - 50, rightYPos, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(transaction.dueDate ? new Date(transaction.dueDate).toLocaleDateString('en-GB') : "Upon Receipt", rightX, rightYPos, { align: "right" });

    rightYPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Status: ", rightX - 50, rightYPos, { align: "right" });
    const statusColor = transaction.paymentStatus === 'paid' ? green : transaction.paymentStatus === 'pending' ? [217, 119, 6] as [number, number, number] : red;
    doc.setTextColor(...statusColor);
    doc.setFont("helvetica", "bold");
    doc.text(transaction.paymentStatus.toUpperCase(), rightX, rightYPos, { align: "right" });

    // Black border line under header
    yPos = Math.max(yPos, rightYPos) + 8;
    doc.setDrawColor(...black);
    doc.setLineWidth(1.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // BILLING SECTION
    // Bill To (left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.text("Bill To", margin, yPos);

    yPos += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(transaction.customerName, margin, yPos);

    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);

    if (transaction.customerEmail) {
      doc.text(transaction.customerEmail, margin, yPos);
      yPos += 4;
    }
    if (transaction.customerPhone) {
      doc.text(transaction.customerPhone, margin, yPos);
      yPos += 4;
    }
    if (transaction.customerAddress) {
      doc.text(transaction.customerAddress.street, margin, yPos);
      yPos += 4;
      doc.text(`${transaction.customerAddress.city}, ${transaction.customerAddress.state} ${transaction.customerAddress.postalCode}`, margin, yPos);
      yPos += 4;
    }

    // Payment Information (right)
    let paymentYPos = yPos - 20 - (transaction.customerEmail ? 4 : 0) - (transaction.customerPhone ? 4 : 0);
    const paymentX = pageWidth / 2 + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.text("Payment Information", paymentX, paymentYPos);

    paymentYPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);

    doc.setFont("helvetica", "bold");
    doc.text("Payment Method: ", paymentX, paymentYPos);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.paymentMethod.replace(/_/g, ' ').toUpperCase(), paymentX + 35, paymentYPos);

    paymentYPos += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Currency: ", paymentX, paymentYPos);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.currency, paymentX + 20, paymentYPos);

    if (transaction.paymentReference) {
      paymentYPos += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Reference: ", paymentX, paymentYPos);
      doc.setFont("helvetica", "normal");
      doc.text(transaction.paymentReference, paymentX + 22, paymentYPos);
    }

    yPos = Math.max(yPos, paymentYPos) + 10;

    // ITEMS TABLE
    // Table header
    const tableStartX = margin;
    const colWidths = [75, 25, 30, 30, 30]; // Description, Qty, Unit Price, Discount, Total

    // Header background
    doc.setFillColor(...lightGray);
    doc.rect(tableStartX, yPos, pageWidth - (2 * margin), 8, 'F');

    // Header text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...gray);

    let xOffset = tableStartX + 2;
    doc.text("Description", xOffset, yPos + 5);
    xOffset += colWidths[0];
    doc.text("Qty", xOffset, yPos + 5);
    xOffset += colWidths[1];
    doc.text("Unit Price", xOffset, yPos + 5);
    xOffset += colWidths[2];
    doc.text("Discount", xOffset, yPos + 5);
    xOffset += colWidths[3];
    doc.text("Total", xOffset, yPos + 5);

    yPos += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    transaction.items.forEach((item, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(249, 250, 251);
        doc.rect(tableStartX, yPos, pageWidth - (2 * margin), 10, 'F');
      }

      xOffset = tableStartX + 2;

      // Description
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkGray);
      doc.setFontSize(9);
      doc.text(item.name, xOffset, yPos + 4);

      if (item.description) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...gray);
        const descLines = doc.splitTextToSize(item.description, colWidths[0] - 4);
        doc.text(descLines[0] || '', xOffset, yPos + 8);
      }

      xOffset += colWidths[0];

      // Quantity
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...darkGray);
      const qtyText = item.saleType === 'volume' && item.baseUnit
        ? `${item.quantity} ${item.baseUnit}`
        : item.quantity.toString();
      doc.text(qtyText, xOffset, yPos + 5);

      xOffset += colWidths[1];

      // Unit Price
      doc.text(`${transaction.currency} ${item.unitPrice.toFixed(2)}`, xOffset, yPos + 5);

      xOffset += colWidths[2];

      // Discount
      if (item.discountAmount && item.discountAmount > 0) {
        doc.setTextColor(...green);
        doc.text(`-${transaction.currency} ${item.discountAmount.toFixed(2)}`, xOffset, yPos + 5);
      } else {
        doc.setTextColor(...gray);
        doc.text('-', xOffset, yPos + 5);
      }

      xOffset += colWidths[3];

      // Total
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkGray);
      doc.text(`${transaction.currency} ${item.totalPrice.toFixed(2)}`, xOffset, yPos + 5);

      yPos += item.description ? 12 : 10;
    });

    // Table border
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.rect(tableStartX, yPos - (transaction.items.length * 10) - 8, pageWidth - (2 * margin), (transaction.items.length * 10) + 8);

    yPos += 10;

    // TOTALS SECTION
    const totalsX = pageWidth - 80;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text("Subtotal:", totalsX, yPos);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text(`${transaction.currency} ${transaction.subtotal.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });

    // Member discounts
    const memberDiscountTotal = transaction.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    if (memberDiscountTotal > 0) {
      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text("Member Discounts:", totalsX, yPos);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...green);
      doc.text(`-${transaction.currency} ${memberDiscountTotal.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
    }

    // Additional discount
    if (transaction.discountAmount > 0) {
      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text("Additional Discount:", totalsX, yPos);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...red);
      doc.text(`-${transaction.currency} ${transaction.discountAmount.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
    }

    // Total line
    yPos += 6;
    doc.setDrawColor(...darkGray);
    doc.setLineWidth(1);
    doc.line(totalsX - 5, yPos, pageWidth - margin, yPos);

    yPos += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.text("Total:", totalsX, yPos);
    doc.text(`${transaction.currency} ${transaction.totalAmount.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });

    // Save the PDF
    const fileName = `${transaction.invoiceNumber || transaction.transactionNumber}-LeafToLife.pdf`;
    doc.save(fileName);


  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF');
  }
}

// Alternative HTML generation for display purposes only
export function generateInvoiceHTML(transaction: Transaction): string {
  const companyInfo = defaultCompanyInfo

  // Calculate member discount total
  const memberDiscountTotal = transaction.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${transaction.invoiceNumber || transaction.transactionNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #111827;
          background: white;
          padding: 48px;
          line-height: 1.5;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 48px;
        }

        /* Header Section */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 24px;
          border-bottom: 4px solid #000;
        }
        .company-info h1 {
          font-size: 30px;
          font-weight: bold;
          color: #000;
          margin-bottom: 12px;
        }
        .company-info p {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.4;
          margin: 2px 0;
        }

        .invoice-title h2 {
          font-size: 36px;
          font-weight: 300;
          color: #374151;
          margin-bottom: 12px;
        }
        .invoice-details {
          font-size: 14px;
          text-align: right;
        }
        .invoice-details p {
          margin: 2px 0;
        }
        .invoice-details .label {
          font-weight: 600;
          display: inline-block;
          margin-right: 8px;
        }

        /* Billing Section */
        .billing-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-bottom: 32px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .customer-name {
          font-weight: 600;
          font-size: 18px;
          color: #374151;
          margin-bottom: 4px;
        }
        .customer-details {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }
        .payment-info {
          font-size: 14px;
          line-height: 1.5;
        }
        .payment-info span.label {
          font-weight: 600;
        }

        /* Items Table */
        .items-table {
          width: 100%;
          margin: 32px 0;
          border-collapse: collapse;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .items-table th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
        }
        .items-table td {
          padding: 12px 16px;
          font-size: 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        .items-table tbody tr:hover {
          background-color: #f9fafb;
        }
        .items-table .text-right {
          text-align: right;
        }
        .items-table .text-center {
          text-align: center;
        }
        .item-name {
          font-weight: 600;
          color: #374151;
        }
        .item-description {
          font-size: 14px;
          color: #9ca3af;
          font-style: italic;
          margin-top: 2px;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          margin-left: 8px;
          border: 1px solid;
        }
        .badge-service {
          background: transparent;
          color: #6b7280;
          border-color: #d1d5db;
        }
        .badge-volume {
          background: #fef3c7;
          color: #d97706;
          border-color: #fde68a;
        }
        .badge-discount {
          background: #d1fae5;
          color: #059669;
          border-color: #a7f3d0;
        }
        .discount-amount {
          color: #059669;
          font-weight: 600;
        }

        /* Totals Section */
        .totals-section {
          margin-left: auto;
          width: 320px;
          margin-top: 32px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.border-bottom {
          border-bottom: 1px solid #e5e7eb;
        }
        .totals-row.border-top {
          border-top: 2px solid #374151;
          margin-top: 8px;
          padding-top: 12px;
        }
        .totals-label {
          color: #6b7280;
        }
        .totals-value {
          font-weight: 600;
          color: #111827;
        }
        .discount-value {
          color: #059669;
        }
        .additional-discount-value {
          color: #dc2626;
        }
        .total-row {
          font-size: 18px;
          font-weight: bold;
        }
        .total-row .totals-label,
        .total-row .totals-value {
          color: #374151;
        }

        /* Payment Status */
        .payment-status {
          background: #dcfce7;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 16px;
          margin: 32px 0;
        }
        .payment-status h4 {
          color: #166534;
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .payment-status p {
          color: #15803d;
          font-size: 14px;
          margin: 4px 0;
        }
        .payment-status .label {
          font-weight: 600;
        }

        /* Notes Section */
        .notes-section {
          background: #f9fafb;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
          padding: 16px;
          margin: 32px 0;
        }
        .notes-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .notes-section p {
          font-size: 14px;
          font-style: italic;
          color: #6b7280;
        }

        /* Footer */
        .invoice-footer {
          text-align: center;
          padding-top: 32px;
          margin-top: 32px;
          border-top: 1px solid #e5e7eb;
        }
        .invoice-footer p {
          font-size: 14px;
          color: #6b7280;
          margin: 4px 0;
        }
        .thank-you {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 8px;
        }
        .terms-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
        }
        .terms-title {
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
        }

        @media print {
          body {
            background: white;
            padding: 0;
          }
          .invoice-container {
            padding: 20px;
            max-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="invoice-header">
          <div class="company-info">
            <h1>${companyInfo.name}</h1>
            <p>${companyInfo.address.street}</p>
            <p>${companyInfo.address.city}, ${companyInfo.address.postalCode}</p>
            <p>Phone: ${companyInfo.phone}</p>
            <p>Email: ${companyInfo.email}</p>
            ${companyInfo.website ? `<p>Website: ${companyInfo.website}</p>` : ''}
          </div>
          <div>
            <h2 class="invoice-title">INVOICE</h2>
            <div class="invoice-details">
              <p><span class="label">Invoice #:</span> ${transaction.invoiceNumber || transaction.transactionNumber}</p>
              <p><span class="label">Date:</span> ${new Date(transaction.transactionDate).toLocaleDateString('en-GB')}</p>
              <p><span class="label">Due Date:</span> ${transaction.dueDate ? new Date(transaction.dueDate).toLocaleDateString('en-GB') : 'Upon Receipt'}</p>
              <p><span class="label">Status:</span> <span style="text-transform: uppercase; font-weight: bold; color: ${transaction.paymentStatus === 'paid' ? '#059669' : transaction.paymentStatus === 'pending' ? '#d97706' : '#dc2626'};">${transaction.paymentStatus}</span></p>
            </div>
          </div>
        </div>

        <!-- Billing Information -->
        <div class="billing-section">
          <div>
            <h3 class="section-title">Bill To</h3>
            <div class="customer-details">
              <div class="customer-name">${transaction.customerName}</div>
              ${transaction.customerEmail ? `<p>${transaction.customerEmail}</p>` : ''}
              ${transaction.customerPhone ? `<p>${transaction.customerPhone}</p>` : ''}
              ${transaction.customerAddress ? `
                <p>${transaction.customerAddress.street}</p>
                <p>${transaction.customerAddress.city}, ${transaction.customerAddress.state} ${transaction.customerAddress.postalCode}</p>
              ` : ''}
            </div>
          </div>
          <div>
            <h3 class="section-title">Payment Information</h3>
            <div class="payment-info">
              <p><span class="label">Payment Method:</span> ${transaction.paymentMethod.replace(/_/g, ' ').toUpperCase()}</p>
              <p><span class="label">Currency:</span> ${transaction.currency}</p>
              ${transaction.paymentReference ? `<p><span class="label">Reference:</span> ${transaction.paymentReference}</p>` : ''}
              ${transaction.terms ? `<p><span class="label">Terms:</span> ${transaction.terms.length > 30 ? transaction.terms.substring(0, 30) + '...' : transaction.terms}</p>` : ''}
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right" style="width: 80px;">Qty</th>
              <th class="text-right" style="width: 100px;">Unit Price</th>
              <th class="text-right" style="width: 100px;">Discount</th>
              <th class="text-right" style="width: 100px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${transaction.items.map(item => `
              <tr>
                <td>
                  <div class="item-name">
                    ${item.name}
                    ${item.isService ? '<span class="badge badge-service">Service</span>' : ''}
                    ${item.saleType === 'volume' ? '<span class="badge badge-volume">Sold in Parts</span>' : ''}
                    ${(item.discountAmount && item.discountAmount > 0) ? '<span class="badge badge-discount">Member Discount Applied</span>' : ''}
                  </div>
                  ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
                </td>
                <td class="text-right">${item.saleType === 'volume' && item.baseUnit ? `${item.quantity} ${item.baseUnit}` : (item.saleType === 'quantity' ? (item.quantity === 1 ? '1 unit' : `${item.quantity} units`) : item.quantity)}</td>
                <td class="text-right">${transaction.currency} ${item.unitPrice.toFixed(2)}</td>
                <td class="text-right">
                  ${(item.discountAmount && item.discountAmount > 0)
                    ? `<span class="discount-amount">-${transaction.currency} ${item.discountAmount.toFixed(2)}</span>`
                    : '<span style="color: #9ca3af;">-</span>'}
                </td>
                <td class="text-right" style="font-weight: 600;">${transaction.currency} ${item.totalPrice.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
          <div class="totals-row border-bottom">
            <span class="totals-label">Subtotal:</span>
            <span class="totals-value">${transaction.currency} ${transaction.subtotal.toFixed(2)}</span>
          </div>
          ${memberDiscountTotal > 0 ? `
            <div class="totals-row border-bottom">
              <span class="totals-label">Member Discounts:</span>
              <span class="totals-value discount-value">-${transaction.currency} ${memberDiscountTotal.toFixed(2)}</span>
            </div>
          ` : ''}
          ${transaction.discountAmount > 0 ? `
            <div class="totals-row border-bottom">
              <span class="totals-label">Additional Discount:</span>
              <span class="totals-value additional-discount-value">-${transaction.currency} ${transaction.discountAmount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="totals-row total-row border-top">
            <span class="totals-label">Total:</span>
            <span class="totals-value">${transaction.currency} ${transaction.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <!-- Payment Status -->
        ${transaction.paymentStatus === 'paid' ? `
          <div class="payment-status">
            <h4>✓ Payment Received</h4>
            <p><span class="label">Amount Paid:</span> ${transaction.currency} ${transaction.paidAmount.toFixed(2)}</p>
            ${transaction.changeAmount > 0 ? `<p><span class="label">Change Given:</span> ${transaction.currency} ${transaction.changeAmount.toFixed(2)}</p>` : ''}
            ${transaction.paidDate ? `<p><span class="label">Payment Date:</span> ${new Date(transaction.paidDate).toLocaleDateString('en-GB')}</p>` : ''}
          </div>
        ` : ''}

        <!-- Notes -->
        ${transaction.notes ? `
          <div class="notes-section">
            <h4>Notes</h4>
            <p>${transaction.notes}</p>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="invoice-footer">
          <p class="thank-you">Thank you for your business!</p>
          <p>For questions about this invoice, please contact us at ${companyInfo.email} or ${companyInfo.phone}</p>
          ${transaction.terms && transaction.terms.length > 30 ? `
            <div class="terms-section">
              <p class="terms-title">Terms & Conditions:</p>
              <p>${transaction.terms}</p>
            </div>
          ` : ''}
      </div>
    </body>
    </html>
  `
}