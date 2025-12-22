import type { Transaction, CompanyInfo as BaseCompanyInfo, Address } from '@/types/transaction';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/validators';

interface EmailTemplateOptions {
  customerName: string;
  hasAttachment: boolean;
  isRetry?: boolean;
  customMessage?: string;
  includePaymentInstructions?: boolean;
}

// Extend the base CompanyInfo to include UEN for Singapore businesses
interface CompanyInfo extends BaseCompanyInfo {
  uen?: string;
  address: Address & {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

const defaultCompanyInfo: CompanyInfo = {
  name: "SEBASTIAN LIEW CENTRE PTE LTD",
  address: {
    street: "320 Serangoon Road, Centrium square, #11-10",
    city: "Singapore",
    state: "",
    postalCode: "218108"
  },
  phone: "+65 6538 9978",
  email: "customerservice@leaftolife.com.sg",
  website: "www.leaftolife.com.sg",
  uen: "200408889Z",
  taxId: "200408889Z",
  logo: "/slc-logo.jpeg" // Using the public logo file
};

export class InvoiceEmailTemplates {
  /**
   * Generate professional invoice email HTML
   */
  static generateInvoiceEmail(
    transaction: Transaction,
    options: EmailTemplateOptions
  ): string {
    const formattedDate = format(new Date(transaction.transactionDate), 'dd MMM yyyy');
    const totalAmount = formatCurrency(transaction.totalAmount, transaction.currency);
    const dueDate = transaction.dueDate ? format(new Date(transaction.transactionDate), 'dd MMM yyyy') : null;
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${transaction.invoiceNumber}</title>
        ${this.getEmailStyles()}
      </head>
      <body>
        <div class="email-container">
          ${this.generateHeader(transaction, options.isRetry)}
          
          <div class="content">
            ${this.generateGreeting(options.customerName, options.isRetry)}
            
            ${options.customMessage ? this.generateCustomMessage(options.customMessage) : ''}
            
            ${this.generateInvoiceSummary(transaction, formattedDate, totalAmount, dueDate)}
            
            ${options.hasAttachment ? this.generateAttachmentSection() : this.generateNoAttachmentSection()}
            
            ${transaction.paymentStatus === 'pending' && options.includePaymentInstructions !== false 
              ? this.generatePaymentInstructions(transaction, dueDate) 
              : this.generatePaymentMethodsOnly(transaction)
            }
            
            ${this.generateItemsSummary(transaction)}
            
            ${this.generateContactSection()}
            
            ${this.generateClosing()}
          </div>
          
          ${this.generateFooter()}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate email styles
   */
  private static getEmailStyles(): string {
    return `
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #209F85, #18826D);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .retry-badge {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 10px;
          display: inline-block;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .custom-message {
          background: #e8f4fd;
          border-left: 4px solid #209F85;
          padding: 15px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .invoice-summary {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 25px;
          margin: 25px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .invoice-summary h3 {
          margin: 0 0 20px 0;
          color: #209F85;
          font-size: 18px;
          border-bottom: 2px solid #209F85;
          padding-bottom: 10px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 0;
        }
        .summary-row:last-child {
          margin-bottom: 0;
        }
        .summary-label {
          font-weight: 500;
          color: #555;
        }
        .summary-value {
          font-weight: 600;
          color: #333;
        }
        .total-row {
          border-top: 2px solid #209F85;
          padding-top: 10px;
          margin-top: 10px;
          font-size: 16px;
        }
        .total-row .summary-value {
          color: #209F85;
          font-size: 18px;
          font-weight: 700;
        }
        .attachment-section {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .attachment-section .icon {
          font-size: 20px;
          margin-right: 8px;
        }
        .no-attachment-section {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .payment-instructions {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
        }
        .payment-instructions h4 {
          margin: 0 0 15px 0;
          color: #721c24;
          font-size: 16px;
        }
        .payment-instructions ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .payment-instructions li {
          margin-bottom: 5px;
        }
        .items-summary {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .items-summary h4 {
          margin: 0 0 15px 0;
          color: #209F85;
          font-size: 16px;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .item-row:last-child {
          border-bottom: none;
        }
        .item-name {
          flex: 1;
          font-weight: 500;
        }
        .item-quantity {
          min-width: 60px;
          text-align: center;
          color: #666;
        }
        .item-price {
          min-width: 80px;
          text-align: right;
          font-weight: 600;
        }
        .contact-section {
          background: #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .contact-section h4 {
          margin: 0 0 15px 0;
          color: #209F85;
          font-size: 16px;
        }
        .contact-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 10px;
        }
        .contact-item {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .contact-item .icon {
          margin-right: 8px;
          color: #209F85;
          font-weight: bold;
        }
        .closing {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        .signature {
          margin-top: 20px;
          font-weight: 500;
        }
        .footer {
          background: #343a40;
          color: white;
          text-align: center;
          padding: 20px;
          font-size: 14px;
        }
        .footer p {
          margin: 5px 0;
          opacity: 0.8;
        }
        .footer .company-name {
          font-weight: 600;
          opacity: 1;
        }
        
        @media (max-width: 600px) {
          .email-container {
            margin: 0;
            box-shadow: none;
          }
          .content {
            padding: 20px;
          }
          .summary-row, .item-row {
            flex-direction: column;
          }
          .summary-value, .item-price {
            text-align: left;
            margin-top: 4px;
          }
          .contact-info {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  }

  /**
   * Generate email header
   */
  private static generateHeader(transaction: Transaction, isRetry?: boolean): string {
    // For email templates, we can use either a full URL or a cid: reference for embedded images
    // If the logo is a relative path, it won't work in emails, so we need to handle this appropriately
    const logoHtml = defaultCompanyInfo.logo 
      ? `<img src="${defaultCompanyInfo.logo.startsWith('http') || defaultCompanyInfo.logo.startsWith('cid:') 
          ? defaultCompanyInfo.logo 
          : `cid:logo`}" alt="${defaultCompanyInfo.name}" style="height: 70px; margin-bottom: 15px; border-radius: 8px; background: white; padding: 5px;">` 
      : '';
    
    return `
      <div class="header">
        ${isRetry ? '<div class="retry-badge">RESENT</div>' : ''}
        ${logoHtml}
        <h1 style="font-size: 28px; margin: 10px 0; letter-spacing: 0.5px; text-transform: uppercase;">SEBASTIAN LIEW CENTRE PTE LTD</h1>
        <p style="font-size: 16px; opacity: 0.95; margin-top: 5px; font-weight: 500;">UEN: 200408889Z</p>
        <p style="font-size: 14px; opacity: 0.9; margin-top: 5px;">Your Holistic Healthcare Partner</p>
      </div>
    `;
  }

  /**
   * Generate greeting section
   */
  private static generateGreeting(customerName: string, isRetry?: boolean): string {
    const greeting = isRetry ? 
      `We're resending your invoice as requested.` :
      `Thank you for choosing Sebastian Liew Centre for your holistic health needs.`;
    
    return `
      <div class="greeting">
        <p>Dear ${customerName},</p>
        <p>${greeting} Your invoice/receipt is now ready and ${isRetry ? 'attached again' : 'attached'} to this email.</p>
      </div>
    `;
  }

  /**
   * Generate custom message section
   */
  private static generateCustomMessage(message: string): string {
    return `
      <div class="custom-message">
        <p><strong>Important:</strong> ${message}</p>
      </div>
    `;
  }

  /**
   * Generate invoice summary
   */
  private static generateInvoiceSummary(
    transaction: Transaction,
    formattedDate: string,
    totalAmount: string,
    _dueDate: string | null
  ): string {
    return `
      <div class="invoice-summary">
        <h3>Invoice Summary</h3>
        <div class="summary-row">
          <span class="summary-label">Invoice Number:</span>
          <span class="summary-value">${transaction.invoiceNumber}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Transaction Date:</span>
          <span class="summary-value">${formattedDate}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Payment Method:</span>
          <span class="summary-value">${transaction.paymentMethod.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Payment Status:</span>
          <span class="summary-value">${transaction.paymentStatus.toUpperCase()}</span>
        </div>
        <div class="summary-row total-row">
          <span class="summary-label">Total Amount:</span>
          <span class="summary-value">${totalAmount}</span>
        </div>
      </div>
    `;
  }

  /**
   * Generate attachment section
   */
  private static generateAttachmentSection(): string {
    return `
      <div class="attachment-section">
        <p><span class="icon">📎</span><strong>PDF Invoice Attached:</strong> Your detailed invoice is attached to this email as a PDF file. You can download, print, or save it for your records.</p>
      </div>
    `;
  }

  /**
   * Generate no attachment section
   */
  private static generateNoAttachmentSection(): string {
    return `
      <div class="no-attachment-section">
        <p><span class="icon">⚠️</span><strong>Note:</strong> The PDF invoice could not be attached to this email. You can download your invoice directly from our customer portal or contact us for assistance.</p>
      </div>
    `;
  }

  /**
   * Generate payment instructions
   */
  private static generatePaymentInstructions(transaction: Transaction, _dueDate: string | null): string {
    return `
      <div class="payment-instructions">
        <h4>🔔 Payment Method</h4>
        <p><strong>Outstanding Amount:</strong> ${formatCurrency(transaction.totalAmount - transaction.paidAmount, transaction.currency)}</p>
        <p><strong>Please complete your payment using one of the following methods:</strong></p>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Option 1: PayNow</strong></p>
          <p style="margin: 5px 0; padding-left: 20px;">PayNow to our UEN: <strong>200408889Z</strong></p>
          <p style="margin: 5px 0; padding-left: 20px;">Company Name: <strong>Sebastian Liew Centre Pte Ltd</strong></p>
        </div>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Option 2: Bank Transfer</strong></p>
          <ul style="margin: 5px 0; padding-left: 35px;">
            <li>Account Number: <strong>0109011323</strong> (current)</li>
            <li>Account Name: <strong>Sebastian Liew Centre Pte. Ltd.</strong></li>
            <li>Bank: <strong>DBS Bank (Singapore)</strong></li>
            <li>Swift Code: <strong>DBSSSGSG</strong></li>
            <li>Bank Code: <strong>7171</strong></li>
            <li>Branch Code: <strong>010</strong></li>
            <li>Bank Address: 12 Marina Boulevard, DBS Asia Central, Marina Bay Financial Centre Tower 3, Singapore 018982</li>
          </ul>
        </div>
        
        <div style="background: #fef2f2; padding: 12px; border-radius: 8px; margin: 15px 0; border: 1px solid #fecaca;">
          <p style="margin: 0; color: #991b1b; font-weight: bold; text-align: center;">⚠️ NO REFUND POLICY</p>
          <p style="margin: 5px 0 0 0; color: #991b1b; text-align: center; font-size: 13px;">All sales are final. No refunds will be provided once payment is processed.</p>
        </div>
        
        <p><em>Please process your payment at your earliest convenience to ensure continued service.</em></p>
      </div>
    `;
  }

  /**
   * Generate payment methods only (for paid invoices)
   */
  private static generatePaymentMethodsOnly(transaction: Transaction): string {
    // Only show payment methods for reference if invoice is already paid
    if (transaction.paymentStatus !== 'paid') {
      return '';
    }
    
    return `
      <div class="payment-instructions" style="background: #e8f4fd; border: 1px solid #209F85;">
        <h4 style="color: #209F85;">💳 Payment Methods for Future Reference</h4>
        <p>Thank you for your payment! For your future reference, here are our payment methods:</p>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Option 1: PayNow</strong></p>
          <p style="margin: 5px 0; padding-left: 20px;">PayNow to our UEN: <strong>200408889Z</strong></p>
          <p style="margin: 5px 0; padding-left: 20px;">Company Name: <strong>Sebastian Liew Centre Pte Ltd</strong></p>
        </div>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Option 2: Bank Transfer</strong></p>
          <ul style="margin: 5px 0; padding-left: 35px;">
            <li>Account Number: <strong>0109011323</strong> (current)</li>
            <li>Account Name: <strong>Sebastian Liew Centre Pte. Ltd.</strong></li>
            <li>Bank: <strong>DBS Bank (Singapore)</strong></li>
            <li>Swift Code: <strong>DBSSSGSG</strong></li>
            <li>Bank Code: <strong>7171</strong></li>
            <li>Branch Code: <strong>010</strong></li>
            <li>Bank Address: 12 Marina Boulevard, DBS Asia Central, Marina Bay Financial Centre Tower 3, Singapore 018982</li>
          </ul>
        </div>
        
        <div style="background: #fef2f2; padding: 12px; border-radius: 8px; margin: 15px 0; border: 1px solid #fecaca;">
          <p style="margin: 0; color: #991b1b; font-weight: bold; text-align: center;">⚠️ NO REFUND POLICY - All sales are final</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate items summary
   */
  private static generateItemsSummary(transaction: Transaction): string {
    const itemsHtml = transaction.items.map(item => `
      <div class="item-row">
        <div class="item-name">
          ${item.name}
          ${item.isService ? ' <span style="color: #666; font-size: 12px;">(Service)</span>' : ''}
          ${(item.discountAmount || 0) > 0 ? ' <span style="color: #15803d; font-size: 12px;">(Member Discount Applied)</span>' : ''}
        </div>
        <div class="item-details">
          <div style="font-size: 12px; color: #666;">
            Qty: ${item.quantity} × ${formatCurrency(item.unitPrice, transaction.currency)}
            ${(item.discountAmount || 0) > 0 ? 
              ` | Discount: -${formatCurrency(item.discountAmount || 0, transaction.currency)}` : ''
            }
          </div>
        </div>
        <div class="item-price">${formatCurrency(item.totalPrice, transaction.currency)}</div>
      </div>
    `).join('');

    const memberDiscountTotal = transaction.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);

    return `
      <div class="items-summary">
        <h4>Items/Services Summary</h4>
        ${itemsHtml}
        
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <div class="item-row">
            <div class="item-name" style="font-weight: 600;">Subtotal</div>
            <div class="item-quantity"></div>
            <div class="item-price" style="font-weight: 600;">${formatCurrency(transaction.subtotal, transaction.currency)}</div>
          </div>
          
          ${memberDiscountTotal > 0 ? `
            <div class="item-row" style="color: #15803d;">
              <div class="item-name">Member Discounts</div>
              <div class="item-quantity"></div>
              <div class="item-price">-${formatCurrency(memberDiscountTotal, transaction.currency)}</div>
            </div>
          ` : ''}
          
          ${transaction.discountAmount > 0 ? `
            <div class="item-row" style="color: #dc2626;">
              <div class="item-name">Additional Discount</div>
              <div class="item-quantity"></div>
              <div class="item-price">-${formatCurrency(transaction.discountAmount, transaction.currency)}</div>
            </div>
          ` : ''}
          
          <div class="item-row" style="border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; font-weight: 700; font-size: 16px;">
            <div class="item-name">Total</div>
            <div class="item-quantity"></div>
            <div class="item-price">${formatCurrency(transaction.totalAmount, transaction.currency)}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate contact section
   */
  private static generateContactSection(): string {
    return `
      <div class="contact-section">
        <h4>Questions? We're Here to Help</h4>
        <p>If you have any questions about this invoice, your treatment, or need assistance, please contact us:</p>
        <div class="contact-info">
          <div class="contact-item">
            <span class="icon">📞</span>
            <span><strong>Phone:</strong> ${defaultCompanyInfo.phone}</span>
          </div>
          <div class="contact-item">
            <span class="icon">✉️</span>
            <span><strong>Email:</strong> ${defaultCompanyInfo.email}</span>
          </div>
          <div class="contact-item">
            <span class="icon">📍</span>
            <span><strong>Address:</strong> ${defaultCompanyInfo.address.street}, ${defaultCompanyInfo.address.city} ${defaultCompanyInfo.address.postalCode}</span>
          </div>
          <div class="contact-item">
            <span class="icon">🌐</span>
            <span><strong>Website:</strong> ${defaultCompanyInfo.website}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate closing section
   */
  private static generateClosing(): string {
    return `
      <div class="closing">
        <p>Thank you for trusting us with your healthcare journey. We appreciate your business and look forward to continuing to serve your health and wellness needs.</p>
        
        <div class="signature">
          <p>Best regards,<br>
          <strong>The Sebastian Liew Centre Team</strong><br>
          ${defaultCompanyInfo.name}${defaultCompanyInfo.uen ? ` (UEN ${defaultCompanyInfo.uen})` : ''}</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate footer
   */
  private static generateFooter(): string {
    return `
      <div class="footer">
        <p class="company-name">${defaultCompanyInfo.name}${defaultCompanyInfo.uen ? ` (UEN ${defaultCompanyInfo.uen})` : ''}</p>
        <p>${defaultCompanyInfo.address.street}, ${defaultCompanyInfo.address.city} ${defaultCompanyInfo.address.postalCode}</p>
        <p>${defaultCompanyInfo.phone} | ${defaultCompanyInfo.email}</p>
        <p>${defaultCompanyInfo.website}</p>
        <br>
        <p style="font-weight: bold; color: #ff6b6b;">NO REFUND POLICY - All sales are final</p>
        <br>
        <p><em>This is an automated message. Please do not reply to this email.</em></p>
        <p><em>If you need to unsubscribe from invoice emails, please contact us directly.</em></p>
      </div>
    `;
  }

  /**
   * Generate simple text version of the email (for clients that don't support HTML)
   */
  static generateTextVersion(transaction: Transaction, options: EmailTemplateOptions): string {
    const formattedDate = format(new Date(transaction.transactionDate), 'dd MMM yyyy');
    const totalAmount = formatCurrency(transaction.totalAmount, transaction.currency);
    const dueDate = transaction.dueDate ? format(new Date(transaction.transactionDate), 'dd MMM yyyy') : null;

    return `
INVOICE - ${defaultCompanyInfo.name}${defaultCompanyInfo.uen ? ` (UEN ${defaultCompanyInfo.uen})` : ''}
${options.isRetry ? '[RESENT] ' : ''}

Dear ${options.customerName},

${options.isRetry ? 'We\'re resending your invoice as requested.' : 'Thank you for choosing Sebastian Liew Centre for your holistic health needs.'} Your invoice/receipt is ready.

INVOICE SUMMARY:
- Invoice Number: ${transaction.invoiceNumber}
- Transaction Date: ${formattedDate}
${dueDate ? `- Due Date: ${dueDate}` : ''}
- Payment Status: ${transaction.paymentStatus.toUpperCase()}
- Total Amount: ${totalAmount}

${options.hasAttachment ? 'Your detailed invoice is attached as a PDF file.' : 'Please contact us to obtain your invoice PDF.'}

${transaction.paymentStatus === 'pending' ? `
PAYMENT REQUIRED:
Amount Due: ${formatCurrency(transaction.totalAmount - transaction.paidAmount, transaction.currency)}
${dueDate ? `Due Date: ${dueDate}` : ''}

PAYMENT METHODS:

Option 1: PayNow
- PayNow to our UEN: 200408889Z
- Company Name: Sebastian Liew Centre Pte Ltd

Option 2: Bank Transfer
- Account Number: 0109011323 (current)
- Account Name: Sebastian Liew Centre Pte. Ltd.
- Bank: DBS Bank (Singapore)
- Swift Code: DBSSSGSG
- Bank Code: 7171
- Branch Code: 010
- Bank Address: 12 Marina Boulevard, DBS Asia Central, Marina Bay Financial Centre Tower 3, Singapore 018982

*** NO REFUND POLICY ***
All sales are final. No refunds will be provided once payment is processed.

Please ensure payment is made by the due date to avoid service interruptions.
` : ''}

ITEMS/SERVICES:
${transaction.items.map(item => `- ${item.name} (Qty: ${item.quantity}): ${formatCurrency(item.totalPrice, transaction.currency)}`).join('\n')}
${transaction.discountAmount > 0 ? `- Discount Applied: -${formatCurrency(transaction.discountAmount, transaction.currency)}` : ''}

CONTACT US:
Phone: ${defaultCompanyInfo.phone}
Email: ${defaultCompanyInfo.email}
Address: ${defaultCompanyInfo.address.street}, ${defaultCompanyInfo.address.city} ${defaultCompanyInfo.address.postalCode}
Website: ${defaultCompanyInfo.website}

Thank you for trusting us with your healthcare journey.

Best regards,
The Sebastian Liew Centre Team
${defaultCompanyInfo.name}${defaultCompanyInfo.uen ? ` (UEN ${defaultCompanyInfo.uen})` : ''}

*** NO REFUND POLICY - All sales are final ***

---
This is an automated message. Please do not reply to this email.
If you need assistance, please contact us using the information above.
    `.trim();
  }

  /**
   * Generate reminder email for overdue invoices
   */
  static generateReminderEmail(transaction: Transaction, options: EmailTemplateOptions & { daysOverdue: number }): string {
    return this.generateInvoiceEmail(transaction, {
      ...options,
      customMessage: `This invoice is ${options.daysOverdue} days overdue. Please process payment as soon as possible to avoid any service disruptions.`,
      includePaymentInstructions: true
    });
  }

  /**
   * Generate thank you email after payment
   */
  static generatePaymentConfirmationEmail(transaction: Transaction, options: EmailTemplateOptions): string {
    return this.generateInvoiceEmail(transaction, {
      ...options,
      customMessage: 'Thank you! Your payment has been received and processed successfully.',
      includePaymentInstructions: false
    });
  }
}