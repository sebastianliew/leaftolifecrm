import type { Transaction } from '@/types/transaction';

const defaultCompanyInfo = {
  name: "Sebastian Liew Centre Pte Ltd.",
  address: {
    street: "320 Serangoon Road, Centrium square, #11-10",
    city: "Singapore",
    state: "",
    postalCode: "218108"
  },
  phone: "+65 6538 9978",
  email: "customerservice@leaftolife.com.sg",
  website: "www.leaftolife.com.sg"
};

export function generateInvoiceHTML(transaction: Transaction): string {
  const companyInfo = defaultCompanyInfo;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${transaction.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #000000;
        }
        
        .company-info h1 {
            font-size: 28px;
            color: #000000;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .company-info p {
            margin: 3px 0;
            color: #666;
            font-size: 14px;
        }
        
        .invoice-title {
            text-align: right;
        }
        
        .invoice-title h2 {
            font-size: 36px;
            color: #1f2937;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .invoice-meta {
            text-align: right;
            font-size: 14px;
        }
        
        .invoice-meta p {
            margin: 3px 0;
        }
        
        .invoice-meta strong {
            color: #1f2937;
        }
        
        .details-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            gap: 40px;
        }
        
        .bill-to, .payment-info {
            flex: 1;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 12px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .bill-to p, .payment-info p {
            margin: 4px 0;
            font-size: 14px;
        }
        
        .customer-name {
            font-weight: 600;
            color: #1f2937;
            font-size: 16px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .items-table th {
            background: #f8fafc;
            color: #374151;
            font-weight: 600;
            padding: 15px 12px;
            text-align: left;
            border-bottom: 2px solid #e5e7eb;
            font-size: 14px;
        }
        
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 14px;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .items-table .text-right {
            text-align: right;
        }
        
        .item-name {
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 4px;
        }
        
        .item-description {
            color: #6b7280;
            font-size: 12px;
            font-style: italic;
        }
        
        .service-badge {
            display: inline-block;
            background: #dbeafe;
            color: #1d4ed8;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            margin-top: 4px;
        }
        
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }
        
        .totals-table {
            width: 300px;
            border-collapse: collapse;
        }
        
        .totals-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 14px;
        }
        
        .totals-table .label {
            text-align: left;
            color: #6b7280;
        }
        
        .totals-table .amount {
            text-align: right;
            font-weight: 500;
        }
        
        .totals-table .discount {
            color: #dc2626;
        }
        
        .totals-table .total-row {
            background: #f8fafc;
            border-top: 2px solid #e5e7eb;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .totals-table .total-row td {
            font-weight: 700;
            font-size: 16px;
            color: #1f2937;
            padding: 12px;
        }
        
        .payment-received {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .payment-received h4 {
            color: #15803d;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .payment-received p {
            margin: 5px 0;
            color: #166534;
            font-size: 14px;
        }
        
        .notes-section {
            margin: 30px 0;
            padding: 20px;
            background: #fafafa;
            border-radius: 8px;
            border-left: 4px solid #000000;
        }
        
        .notes-section h4 {
            color: #1f2937;
            margin-bottom: 10px;
        }
        
        .notes-section p {
            color: #4b5563;
            font-style: italic;
            line-height: 1.5;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }
        
        .footer p {
            margin: 5px 0;
        }
        
        .terms {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #f3f4f6;
            font-weight: 500;
            color: #374151;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-paid {
            background: #dcfce7;
            color: #15803d;
        }
        
        .status-pending {
            background: #fef3c7;
            color: #92400e;
        }
        
        .status-overdue {
            background: #fee2e2;
            color: #dc2626;
        }
        
        @media print {
            @page {
                size: A4;
                margin: 0;
            }

            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                margin: 0;
                padding: 0;
                background: white;
            }
            
            .invoice-container {
                padding: 15px;
                max-width: none;
                width: 100%;
                height: 100%;
                margin: 0;
                box-shadow: none;
                background: white;
            }

            .header {
                margin-bottom: 15px;
                padding-bottom: 8px;
            }

            .company-info h1 {
                font-size: 20px;
                margin-bottom: 5px;
            }

            .company-info p {
                margin: 2px 0;
                font-size: 11px;
            }

            .invoice-title h2 {
                font-size: 24px;
                margin-bottom: 5px;
            }

            .invoice-meta p {
                margin: 2px 0;
                font-size: 11px;
            }

            .details-section {
                margin-bottom: 15px;
                gap: 15px;
            }

            .section-title {
                font-size: 14px;
                margin-bottom: 8px;
            }

            .bill-to p, .payment-info p {
                margin: 2px 0;
                font-size: 11px;
            }

            .items-table {
                margin-bottom: 10px;
                box-shadow: none;
            }

            .items-table th {
                padding: 6px;
                font-size: 11px;
            }

            .items-table td {
                padding: 4px 6px;
                font-size: 11px;
            }

            .item-name {
                font-size: 11px;
            }

            .item-description {
                font-size: 10px;
            }

            .totals-section {
                margin-bottom: 10px;
            }

            .totals-table {
                width: 250px;
            }

            .totals-table td {
                padding: 4px 6px;
                font-size: 11px;
            }

            .payment-received,
            .notes-section {
                margin-bottom: 10px;
                padding: 8px;
            }

            .payment-received h4,
            .notes-section h4 {
                font-size: 12px;
                margin-bottom: 5px;
            }

            .payment-received p,
            .notes-section p {
                margin: 2px 0;
                font-size: 11px;
            }

            .footer {
                margin-top: 15px;
                padding-top: 8px;
                font-size: 10px;
            }

            .footer p {
                margin: 2px 0;
            }

            /* Ensure no page breaks */
            .invoice-container,
            .header,
            .details-section,
            .items-table,
            .totals-section,
            .payment-received,
            .notes-section,
            .footer {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1>${companyInfo.name}</h1>
                <p>${companyInfo.address.street}</p>
                <p>${companyInfo.address.city}, ${companyInfo.address.state} ${companyInfo.address.postalCode}</p>
                <p>Phone: ${companyInfo.phone}</p>
                <p>Email: ${companyInfo.email}</p>
                ${companyInfo.website ? `<p>Website: ${companyInfo.website}</p>` : ''}
            </div>
            <div class="invoice-title">
                <h2>INVOICE</h2>
                <div class="invoice-meta">
                    <p><strong>Invoice #:</strong> ${transaction.invoiceNumber}</p>
                    <p><strong>Date:</strong> ${new Date(transaction.transactionDate).toLocaleDateString('en-GB')}</p>
                    <p><strong>Due Date:</strong> ${transaction.dueDate ? new Date(transaction.dueDate).toLocaleDateString('en-GB') : 'Upon Receipt'}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${transaction.paymentStatus}">${transaction.paymentStatus}</span></p>
                </div>
            </div>
        </div>

        <!-- Details Section -->
        <div class="details-section">
            <div class="bill-to">
                <h3 class="section-title">Bill To</h3>
                <p class="customer-name">${transaction.customerName}</p>
                ${transaction.customerEmail ? `<p>${transaction.customerEmail}</p>` : ''}
                ${transaction.customerPhone ? `<p>${transaction.customerPhone}</p>` : ''}
                ${transaction.customerAddress ? `
                    <p>${transaction.customerAddress.street}</p>
                    <p>${transaction.customerAddress.city}, ${transaction.customerAddress.state} ${transaction.customerAddress.postalCode}</p>
                ` : ''}
            </div>
            <div class="payment-info">
                <h3 class="section-title">Payment Information</h3>
                <p><strong>Payment Method:</strong> ${transaction.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Currency:</strong> ${transaction.currency}</p>
                ${transaction.paymentReference ? `<p><strong>Reference:</strong> ${transaction.paymentReference}</p>` : ''}
                ${transaction.terms ? `<p><strong>Terms:</strong> ${transaction.terms}</p>` : ''}
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 40%;">Description</th>
                    <th class="text-right" style="width: 12%;">Qty</th>
                    <th class="text-right" style="width: 16%;">Unit Price</th>
                    <th class="text-right" style="width: 16%;">Discount</th>
                    <th class="text-right" style="width: 16%;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${transaction.items.map(item => `
                    <tr>
                        <td>
                            <div class="item-name">${item.name}</div>
                            ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
                            ${item.isService ? '<span class="service-badge">Service</span>' : ''}
                            ${(item.discountAmount || 0) > 0 ? '<span class="service-badge" style="background: #dcfce7; color: #15803d;">Member Discount Applied</span>' : ''}
                        </td>
                        <td class="text-right">${item.quantity}</td>
                        <td class="text-right">${transaction.currency} ${item.unitPrice.toFixed(2)}</td>
                        <td class="text-right">
                            ${(item.discountAmount || 0) > 0 ? 
                                `<span style="color: #15803d; font-weight: 600;">-${transaction.currency} ${(item.discountAmount || 0).toFixed(2)}</span>` : 
                                `<span style="color: #9ca3af;">-</span>`
                            }
                        </td>
                        <td class="text-right">${transaction.currency} ${item.totalPrice.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td class="label">Subtotal:</td>
                    <td class="amount">${transaction.currency} ${transaction.subtotal.toFixed(2)}</td>
                </tr>
                ${transaction.items.some(item => (item.discountAmount || 0) > 0) ? `
                    <tr>
                        <td class="label">Member Discounts:</td>
                        <td class="amount" style="color: #15803d; font-weight: 600;">-${transaction.currency} ${transaction.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0).toFixed(2)}</td>
                    </tr>
                ` : ''}
                ${transaction.discountAmount > 0 ? `
                    <tr>
                        <td class="label">Additional Discount:</td>
                        <td class="amount discount">-${transaction.currency} ${transaction.discountAmount.toFixed(2)}</td>
                    </tr>
                ` : ''}
                <tr class="total-row">
                    <td class="label">Total:</td>
                    <td class="amount">${transaction.currency} ${(transaction.subtotal - transaction.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0) - transaction.discountAmount).toFixed(2)}</td>
                </tr>
            </table>
        </div>

        <!-- Payment Information -->
        ${transaction.paymentStatus === 'paid' ? `
            <div class="payment-received">
                <h4>✓ Payment Received</h4>
                <p><strong>Amount Paid:</strong> ${transaction.currency} ${transaction.paidAmount.toFixed(2)}</p>
                ${transaction.changeAmount > 0 ? `<p><strong>Change Given:</strong> ${transaction.currency} ${transaction.changeAmount.toFixed(2)}</p>` : ''}
                ${transaction.paidDate ? `<p><strong>Payment Date:</strong> ${new Date(transaction.paidDate).toLocaleDateString('en-GB')}</p>` : ''}
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
        <div class="footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>For questions about this invoice, please contact us at ${companyInfo.email} or ${companyInfo.phone}</p>
            ${transaction.terms ? `
                <div class="terms">
                    <strong>Terms & Conditions:</strong> ${transaction.terms}
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
} 