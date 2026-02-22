import PDFDocument from 'pdfkit';
import fs from 'fs';
import QRCode from 'qrcode';

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount?: number;
  itemType?: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'consultation' | 'service';
}

interface InvoiceData {
  invoiceNumber: string;
  transactionNumber: string;
  transactionDate: Date;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  additionalDiscount?: number;
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  currency?: string;
  dueDate?: Date | string;
  paidDate?: Date;
  paidAmount?: number;
  status?: string;
}

export class InvoiceGenerator {
  private doc: PDFKit.PDFDocument;
  private yPosition: number;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;

  constructor() {
    this.doc = new PDFDocument({ size: 'A4', margin: 50 });
    this.yPosition = 50;
    this.pageWidth = 595.28; // A4 width in points
    this.pageHeight = 841.89; // A4 height in points
    this.margin = 50;
  }

  async generateInvoice(data: InvoiceData, outputPath: string): Promise<void> {
    const stream = fs.createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        console.log('[InvoiceGenerator] PDF created successfully:', outputPath);
        resolve();
      });

      stream.on('error', (error) => {
        console.error('[InvoiceGenerator] Error writing PDF:', error);
        reject(error);
      });

      this.doc.pipe(stream);

      // Handle async operations separately
      (async () => {
        try {
          // Generate invoice content
          this.addHeader(data);
          this.addCustomerAndPaymentInfo(data);
          this.addItemsTable(data);
          this.addTotals(data);
          this.addPaymentStatusBox(data);
          await this.addPaymentRequiredBox(data);
          this.addFooter(data);

          this.doc.end();
        } catch (error) {
          console.error('[InvoiceGenerator] Error generating invoice content:', error);
          reject(error);
        }
      })();
    });
  }

  private addHeader(data: InvoiceData): void {
    const startY = this.yPosition;

    // Left side: Company Information
    this.doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Leaf to Life \u00AE', this.margin, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text('by Sebastian Liew Centre Pte Ltd', this.margin, this.yPosition);

    this.yPosition += 18;

    this.doc
      .fontSize(9)
      .font('Helvetica')
      .text('320 Serangoon Road, Centrium square, #11-10', this.margin, this.yPosition);

    this.yPosition += 12;

    this.doc
      .text('Singapore, 218108', this.margin, this.yPosition);

    this.yPosition += 12;

    this.doc
      .text('Phone: +65 6538 9978', this.margin, this.yPosition);

    this.yPosition += 12;

    this.doc
      .text('Email: customerservice@leaftolife.com.sg', this.margin, this.yPosition);

    this.yPosition += 12;

    this.doc
      .text('Website: www.leaftolife.com.sg', this.margin, this.yPosition);

    // Right side: Invoice Details
    const rightX = this.pageWidth - this.margin - 180;
    let rightY = startY;

    this.doc
      .fontSize(32)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('INVOICE', rightX, rightY, { align: 'right', width: 180 });

    rightY += 40;

    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Invoice #: ', rightX, rightY, { continued: true })
      .font('Helvetica')
      .text(data.invoiceNumber);

    rightY += 15;

    this.doc
      .font('Helvetica-Bold')
      .text('Date: ', rightX, rightY, { continued: true })
      .font('Helvetica')
      .text(this.formatDateShort(data.transactionDate));

    rightY += 15;

    // Format due date - check if it's a valid date or use default text
    let dueDate = 'Upon Receipt';
    if (data.dueDate && data.dueDate !== 'Upon Receipt') {
      try {
        dueDate = this.formatDateShort(data.dueDate);
      } catch (e) {
        dueDate = 'Upon Receipt';
      }
    }

    this.doc
      .font('Helvetica-Bold')
      .text('Due Date: ', rightX, rightY, { continued: true })
      .font('Helvetica')
      .text(dueDate);

    rightY += 15;

    // Status badge
    const status = this.formatPaymentStatus(data.paymentStatus || 'pending');
    const statusColor = this.getStatusColor(data.paymentStatus || 'pending');

    this.doc
      .font('Helvetica-Bold')
      .text('Status: ', rightX, rightY, { continued: true });

    this.doc
      .fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(status.toUpperCase());

    this.yPosition = 150;
    this.addDivider();
  }

  private addCustomerAndPaymentInfo(data: InvoiceData): void {
    this.yPosition += 20;
    const leftColX = this.margin;
    const rightColX = this.pageWidth / 2 + 20;
    const startY = this.yPosition;

    // Left Column: Bill To
    this.doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Bill To', leftColX, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(data.customerName, leftColX, this.yPosition);

    if (data.customerEmail) {
      this.yPosition += 15;
      this.doc.text(data.customerEmail, leftColX, this.yPosition);
    }

    if (data.customerPhone) {
      this.yPosition += 15;
      this.doc.text(data.customerPhone, leftColX, this.yPosition);
    }

    // Right Column: Payment Information
    let rightY = startY;

    this.doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Payment Information', rightColX, rightY);

    rightY += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Payment Method: ', rightColX, rightY, { continued: true })
      .font('Helvetica')
      .text(this.formatPaymentMethod(data.paymentMethod || 'cash').toUpperCase());

    rightY += 15;

    const currency = data.currency || 'SGD';
    this.doc
      .font('Helvetica-Bold')
      .text('Currency: ', rightColX, rightY, { continued: true })
      .font('Helvetica')
      .text(currency);

    this.yPosition += 40;
    this.addDivider();
  }

  private addItemsTable(data: InvoiceData): void {
    this.yPosition += 20;

    // Table headers
    const col1X = this.margin;
    const col2X = this.pageWidth - this.margin - 270;
    const col3X = this.pageWidth - this.margin - 200;
    const col4X = this.pageWidth - this.margin - 120;
    const col5X = this.pageWidth - this.margin - 60;

    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Description', col1X, this.yPosition)
      .text('Qty', col2X, this.yPosition)
      .text('Unit Price', col3X, this.yPosition)
      .text('Discount', col4X, this.yPosition)
      .text('Total', col5X, this.yPosition);

    this.yPosition += 15;

    // Lighter divider for table
    this.doc
      .moveTo(this.margin, this.yPosition)
      .lineTo(this.pageWidth - this.margin, this.yPosition)
      .strokeColor('#e0e0e0')
      .stroke();

    this.yPosition += 15;

    // Table rows
    this.doc.font('Helvetica').fontSize(9).fillColor('#000000');

    data.items.forEach((item, index) => {
      // Check if we need a new page
      if (this.yPosition > this.pageHeight - 250) {
        this.doc.addPage();
        this.yPosition = this.margin;
      }

      // Item description with type details
      let itemDescription = item.name;
      if (item.itemType) {
        const typeLabel = this.getItemTypeLabel(item.itemType, item.quantity);
        itemDescription += ` ${typeLabel}`;
      }

      const maxWidth = col2X - col1X - 10;
      this.doc.text(itemDescription, col1X, this.yPosition, { width: maxWidth });

      // Quantity
      this.doc.text(item.quantity.toString(), col2X, this.yPosition);

      // Unit Price
      const currency = data.currency || 'SGD';
      this.doc.text(this.formatCurrency(item.unitPrice, currency), col3X, this.yPosition);

      // Discount
      if (item.discountAmount && item.discountAmount > 0) {
        this.doc.text(`-${this.formatCurrency(item.discountAmount, currency)}`, col4X, this.yPosition);
      } else {
        this.doc.text('-', col4X, this.yPosition);
      }

      // Total
      this.doc.text(this.formatCurrency(item.totalPrice, currency), col5X, this.yPosition);

      this.yPosition += 25;

      // Add subtle line between items (except last one)
      if (index < data.items.length - 1) {
        this.doc
          .moveTo(this.margin, this.yPosition - 5)
          .lineTo(this.pageWidth - this.margin, this.yPosition - 5)
          .strokeColor('#f0f0f0')
          .stroke();
      }
    });

    this.yPosition += 10;
  }

  private addTotals(data: InvoiceData): void {
    const currency = data.currency || 'SGD';
    const labelX = this.pageWidth - this.margin - 180;
    const valueX = this.pageWidth - this.margin - 60;

    this.doc.fontSize(10).font('Helvetica').fillColor('#000000');

    // Subtotal
    this.doc
      .text('Subtotal:', labelX, this.yPosition)
      .text(this.formatCurrency(data.subtotal, currency), valueX, this.yPosition, { align: 'right', width: 60 });

    // Member Discounts (if any)
    if (data.discountAmount > 0) {
      this.yPosition += 20;
      this.doc.fillColor('#000000').text('Member Discounts:', labelX, this.yPosition);
      this.doc.fillColor('#059669').text(`-${this.formatCurrency(data.discountAmount, currency)}`, valueX, this.yPosition, { align: 'right', width: 60 });
    }

    // Additional Discount (if any)
    if (data.additionalDiscount && data.additionalDiscount > 0) {
      this.yPosition += 20;
      this.doc.fillColor('#000000').text('Additional Discount:', labelX, this.yPosition);
      this.doc.fillColor('#dc2626').text(`-${this.formatCurrency(data.additionalDiscount, currency)}`, valueX, this.yPosition, { align: 'right', width: 60 });
    }

    this.yPosition += 30;

    // Total line
    this.doc
      .moveTo(labelX, this.yPosition)
      .lineTo(this.pageWidth - this.margin, this.yPosition)
      .strokeColor('#333333')
      .lineWidth(1)
      .stroke();

    this.yPosition += 15;

    // Calculate correct total from subtotal minus discounts
    const calculatedTotal = data.subtotal - data.discountAmount - (data.additionalDiscount || 0);

    // Total
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Total:', labelX, this.yPosition)
      .text(this.formatCurrency(calculatedTotal, currency), valueX - 10, this.yPosition, { align: 'right', width: 70 });

    this.yPosition += 40;
  }

  private addPaymentStatusBox(data: InvoiceData): void {
    // Only show if payment is received/paid
    if (data.paymentStatus !== 'paid' || !data.paidAmount) {
      return;
    }

    const boxX = this.margin;
    const boxY = this.yPosition;
    const boxWidth = this.pageWidth - 2 * this.margin;
    const boxHeight = 60;
    const currency = data.currency || 'SGD';

    // Green background box
    this.doc
      .rect(boxX, boxY, boxWidth, boxHeight)
      .fillAndStroke('#d4edda', '#c3e6cb');

    // Content - draw a checkmark box manually since Helvetica doesn't support unicode checkmark
    const contentY = boxY + 15;

    // Draw checkmark box
    const checkBoxX = boxX + 20;
    const checkBoxY = contentY;
    const checkBoxSize = 12;

    // Draw filled green box with checkmark
    this.doc
      .rect(checkBoxX, checkBoxY, checkBoxSize, checkBoxSize)
      .fillAndStroke('#28a745', '#1e7e34');

    // Draw white checkmark lines inside the box
    this.doc
      .strokeColor('#ffffff')
      .lineWidth(1.5)
      .moveTo(checkBoxX + 2, checkBoxY + 6)
      .lineTo(checkBoxX + 5, checkBoxY + 9)
      .lineTo(checkBoxX + 10, checkBoxY + 3)
      .stroke();

    // Payment Received text
    this.doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#155724')
      .text('Payment Received', checkBoxX + checkBoxSize + 8, contentY);

    const detailsY = contentY + 18;
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Amount Paid: ', boxX + 20, detailsY, { continued: true })
      .font('Helvetica')
      .text(this.formatCurrency(data.paidAmount, currency));

    if (data.paidDate) {
      this.doc
        .font('Helvetica-Bold')
        .text('Payment Date: ', boxX + 220, detailsY, { continued: true })
        .font('Helvetica')
        .text(this.formatDateShort(data.paidDate));
    }

    this.yPosition += boxHeight + 20;
  }

  private async addPaymentRequiredBox(data: InvoiceData): Promise<void> {
    // Only show if payment is NOT paid
    if (data.paymentStatus === 'paid') {
      return;
    }

    const currency = data.currency || 'SGD';
    const outstandingAmount = data.totalAmount - (data.paidAmount || 0);

    // Check if we need a new page (need ~480 points for payment section)
    if (this.yPosition > this.pageHeight - 500) {
      this.doc.addPage();
      this.yPosition = this.margin;
    }

    const boxX = this.margin;
    const boxY = this.yPosition;
    const boxWidth = this.pageWidth - 2 * this.margin;

    const headerHeight = 50;

    // Warning icon (triangle)
    const iconX = boxX + 15;
    const iconY = boxY + 15;
    this.doc
      .moveTo(iconX + 8, iconY)
      .lineTo(iconX + 16, iconY + 16)
      .lineTo(iconX, iconY + 16)
      .closePath()
      .fillAndStroke('#856404', '#856404');

    // Exclamation mark in triangle
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#fff3cd')
      .text('!', iconX + 6, iconY + 3);

    // Payment Required text
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#856404')
      .text('Payment Required', iconX + 25, boxY + 12);

    // Outstanding amount
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Outstanding Amount: ${this.formatCurrency(outstandingAmount, currency)}`, iconX + 25, boxY + 30);

    let contentY = boxY + headerHeight + 15;

    // Main instruction text
    this.doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#000000')
      .text(
        'Please complete your payment:',
        boxX + 15,
        contentY,
        { width: boxWidth - 30, lineGap: 2 }
      );

    contentY += 35;

    // PayNow section with QR code
    const sectionX = boxX + 15;
    const sectionWidth = boxWidth - 30;
    const payNowHeight = 110;

    const payNowY = contentY + 10;

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#0d6efd')
      .text('Option 1: PayNow', sectionX + 10, payNowY);

    // Generate QR code
    try {
      const qrCodeBuffer = await QRCode.toBuffer('202527780C', {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 80,
        margin: 1
      });

      // Add QR code to PDF
      const qrX = sectionX + 10;
      const qrY = payNowY + 20;
      this.doc.image(qrCodeBuffer, qrX, qrY, { width: 70, height: 70 });

      // QR code label
      this.doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#000000')
        .text('Scan to Pay', qrX + 13, qrY + 72, { width: 70, align: 'center' });
    } catch (error) {
      console.error('[InvoiceGenerator] Error generating QR code:', error);
    }

    // Payment details next to QR code
    const detailsX = sectionX + 95;
    const detailsY = payNowY + 20;

    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('PayNow to our UEN:', detailsX, detailsY);

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('202527780C', detailsX, detailsY + 15);

    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Company Name:', detailsX, detailsY + 35);

    this.doc
      .fontSize(9)
      .font('Helvetica')
      .text('Leaf to Life Pte Ltd', detailsX, detailsY + 50);

    contentY += payNowHeight + 10;

    // Bank Transfer section
    const bankHeight = 180;
    const bankStartY = contentY;

    contentY += 10;

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#0d6efd')
      .text('Option 2: Bank Transfer', sectionX + 10, contentY);

    contentY += 20;

    const leftColX = sectionX + 10;
    const rightColX = sectionX + sectionWidth / 2 + 10;

    // Left column
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Account Number:', leftColX, contentY);
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('0721361590', leftColX, contentY + 12);

    // Right column
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Account Name:', rightColX, contentY);
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Leaf to Life Pte Ltd', rightColX, contentY + 12);

    contentY += 30;

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Bank:', leftColX, contentY);
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('DBS Bank (Singapore)', leftColX, contentY + 12);

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Swift Code:', rightColX, contentY);
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('DBSSSGSG', rightColX, contentY + 12);

    contentY += 30;

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Bank Code:', leftColX, contentY);
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('7171', leftColX, contentY + 12);

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Branch Code:', rightColX, contentY);
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('010', rightColX, contentY + 12);

    contentY += 30;

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Bank Address:', leftColX, contentY);
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#000000')
      .text('12 Marina Boulevard, DBS Asia Central,', leftColX, contentY + 12, { width: sectionWidth - 20 });
    this.doc
      .text('Marina Bay Financial Centre Tower 3,', leftColX, contentY + 24, { width: sectionWidth - 20 });
    this.doc
      .text('Singapore 018982', leftColX, contentY + 36, { width: sectionWidth - 20 });

    contentY = bankStartY + bankHeight + 10;

    // No Refund Policy section
    const refundHeight = 55;
    const refundStartY = contentY;

    contentY += 12;

    // Warning icon for no refund
    const warningX = sectionX + 10;
    this.doc
      .moveTo(warningX + 6, contentY)
      .lineTo(warningX + 12, contentY + 12)
      .lineTo(warningX, contentY + 12)
      .closePath()
      .fillAndStroke('#721c24', '#721c24');

    this.doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#f8d7da')
      .text('!', warningX + 4, contentY + 2);

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#721c24')
      .text('NO REFUND POLICY', warningX + 18, contentY);

    contentY += 18;

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#721c24')
      .text(
        'All sales are final. No refunds will be provided once payment is processed.',
        warningX + 18,
        contentY,
        { width: sectionWidth - 40, lineGap: 2 }
      );

    this.yPosition = refundStartY + refundHeight + 10;
  }

  private addFooter(data: InvoiceData): void {
    const footerY = this.pageHeight - this.margin - 40;

    // Notes section (if present)
    if (data.notes && this.yPosition < footerY - 60) {
      this.doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Notes:', this.margin, this.yPosition);

      this.yPosition += 15;

      this.doc
        .font('Helvetica')
        .text(data.notes, this.margin, this.yPosition, { width: this.pageWidth - 2 * this.margin });

      this.yPosition += 30;
    }

    // Footer text
    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(
        'Thank you for your business!',
        this.margin,
        footerY,
        { align: 'center', width: this.pageWidth - 2 * this.margin }
      );

    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        'For questions about this invoice, please contact us at customerservice@leaftolife.com.sg or +65 6538 9978',
        this.margin,
        footerY + 15,
        { align: 'center', width: this.pageWidth - 2 * this.margin }
      );
  }

  private addDivider(): void {
    this.doc
      .moveTo(this.margin, this.yPosition)
      .lineTo(this.pageWidth - this.margin, this.yPosition)
      .strokeColor('#000000')
      .lineWidth(1.5)
      .stroke();
  }

  private formatDateShort(date: Date | string): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatCurrency(amount: number, currency: string = 'SGD'): string {
    return `${currency} ${amount.toFixed(2)}`;
  }

  private formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      cash: 'CASH',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      offset_from_credit: 'Offset from Credit',
      paynow: 'PayNow',
      nets: 'NETS',
      web_store: 'Web Store',
      misc: 'Miscellaneous'
    };
    return methods[method.toLowerCase()] || method.toUpperCase();
  }

  private formatPaymentStatus(status: string): string {
    const statuses: Record<string, string> = {
      paid: 'PAID',
      pending: 'PENDING',
      partial: 'Partial',
      overdue: 'OVERDUE',
      failed: 'FAILED',
      refunded: 'Refunded'
    };
    return statuses[status.toLowerCase()] || status;
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      paid: '#28a745',
      pending: '#ffc107',
      partial: '#fd7e14',
      overdue: '#dc3545',
      failed: '#dc3545',
      refunded: '#6c757d'
    };
    return colors[status.toLowerCase()] || '#000000';
  }

  private getItemTypeLabel(itemType: string, quantity: number): string {
    const labels: Record<string, string> = {
      bundle: `(${quantity}x Bundle)`,
      fixed_blend: `(${quantity}x unit)`,
      custom_blend: `(${quantity}x unit)`,
      product: '',
      miscellaneous: '',
      consultation: '(Consultation)',
      service: '(Service)'
    };
    return labels[itemType] || '';
  }
}
