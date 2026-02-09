import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import path from 'path';
import fs from 'fs';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private emailFrom: string = '';
  private initialized: boolean = false;

  private initialize() {
    if (this.initialized) {
      return; // Already initialized
    }
    this.initialized = true;

    // Check if email is explicitly disabled
    const emailEnabled = process.env.EMAIL_ENABLED !== 'false';
    if (!emailEnabled) {
      console.warn('⚠️  Email service is disabled (EMAIL_ENABLED=false). Email features will not work.');
      this.isConfigured = false;
      return;
    }

    const emailHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const emailPort = process.env.SMTP_PORT || process.env.EMAIL_PORT;
    const emailSecure = process.env.SMTP_SECURE === 'true';
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    // Check if email is configured
    if (!emailHost || !emailPort || !emailUser || !emailPassword) {
      console.warn('⚠️  Email service not configured. Email features will be disabled.');
      console.warn('   Please configure SMTP_HOST, SMTP_PORT, EMAIL_USER, and EMAIL_PASS in .env.local');
      console.warn('   Current config:', {
        SMTP_HOST: emailHost ? 'SET' : 'MISSING',
        SMTP_PORT: emailPort ? 'SET' : 'MISSING',
        EMAIL_USER: emailUser ? 'SET' : 'MISSING',
        EMAIL_PASS: emailPassword ? 'SET' : 'MISSING'
      });
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort, 10),
        secure: emailSecure, // Use SMTP_SECURE from env
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      this.emailFrom = emailFrom || emailUser;
      this.isConfigured = true;
      console.log('✅ Email service configured successfully');
      console.log('   Host:', emailHost);
      console.log('   Port:', emailPort);
      console.log('   From:', emailFrom);
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    this.initialize(); // Ensure initialized before use

    if (!this.isConfigured || !this.transporter) {
      console.warn('Email service not configured. Skipping email send.');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.emailFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  async sendInvoiceEmail(
    customerEmail: string,
    customerName: string,
    invoiceNumber: string,
    invoicePath: string,
    transactionAmount: number,
    transactionDate: Date,
    paymentStatus: string
  ): Promise<boolean> {
    this.initialize(); // Ensure initialized before use

    if (!this.isConfigured) {
      console.warn('Email service not configured. Cannot send invoice email.');
      return false;
    }

    // Verify invoice file exists
    if (!fs.existsSync(invoicePath)) {
      throw new Error(`Invoice file not found at path: ${invoicePath}`);
    }

    const formatCurrency = (amount: number) => {
      return `$${amount.toFixed(2)}`;
    };

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const isPaid = paymentStatus === 'paid';
    const paymentStatusText = isPaid ? 'Paid' : 'Payment Required';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px 24px 30px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; color: #333333; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                Leaf to Life &reg;
              </h1>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">
                by Sebastian Liew Centre Pte Ltd
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 30px;">

              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello ${customerName},
              </p>

              <p style="margin: 0 0 28px 0; color: #555555; font-size: 15px; line-height: 1.6;">
                Thank you for your purchase. Your invoice is attached to this email.
              </p>

              <!-- Invoice Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f0f0f0;">
                    Invoice Number
                  </td>
                  <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f0f0f0;">
                    ${invoiceNumber}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f0f0f0;">
                    Date
                  </td>
                  <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f0f0f0;">
                    ${formatDate(transactionDate)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f0f0f0;">
                    Total Amount
                  </td>
                  <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 16px; font-weight: 700; border-bottom: 1px solid #f0f0f0;">
                    ${formatCurrency(transactionAmount)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">
                    Status
                  </td>
                  <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 14px; font-weight: 600; text-transform: uppercase;">
                    ${paymentStatusText}
                  </td>
                </tr>
              </table>

              ${!isPaid ? `
              <!-- Payment Required Notice -->
              <div style="border-left: 3px solid #333333; padding: 12px 16px; margin-bottom: 28px;">
                <p style="margin: 0; color: #555555; font-size: 14px; line-height: 1.5;">
                  <strong>Payment Required:</strong> Please complete your payment using PayNow or Bank Transfer. Details are included in the attached invoice.
                </p>
              </div>

              <!-- Payment Methods -->
              <div style="margin-bottom: 28px;">
                <p style="margin: 0 0 14px 0; color: #333333; font-size: 15px; font-weight: 600;">
                  Payment Methods
                </p>

                <div style="padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 10px;">
                  <p style="margin: 0 0 6px 0; color: #333333; font-weight: 600; font-size: 13px;">
                    PayNow (UEN)
                  </p>
                  <p style="margin: 0; color: #555555; font-size: 13px; line-height: 1.6;">
                    UEN: <strong>202527780C</strong><br>
                    Company: Leaf to Life Pte Ltd
                  </p>
                </div>

                <div style="padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 4px;">
                  <p style="margin: 0 0 6px 0; color: #333333; font-weight: 600; font-size: 13px;">
                    Bank Transfer
                  </p>
                  <p style="margin: 0; color: #555555; font-size: 13px; line-height: 1.6;">
                    Account: <strong>0721361590</strong><br>
                    Bank: DBS Bank (Singapore)<br>
                    Account Name: Leaf to Life Pte Ltd
                  </p>
                </div>
              </div>
              ` : `
              <!-- Payment Confirmed -->
              <div style="border-left: 3px solid #333333; padding: 12px 16px; margin-bottom: 28px;">
                <p style="margin: 0; color: #555555; font-size: 14px; line-height: 1.5;">
                  <strong>Payment Confirmed:</strong> Thank you for your payment. Your transaction has been completed successfully.
                </p>
              </div>
              `}

              <!-- Attached Invoice -->
              <p style="margin: 0 0 28px 0; color: #555555; font-size: 14px; line-height: 1.6;">
                Your detailed invoice is attached as a PDF file.
              </p>

              <!-- Contact Information -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #333333; font-size: 14px; font-weight: 600;">
                  Questions?
                </p>
                <p style="margin: 0; color: #555555; font-size: 13px; line-height: 1.8;">
                  <a href="mailto:customerservice@leaftolife.com.sg" style="color: #333333; text-decoration: underline;">customerservice@leaftolife.com.sg</a><br>
                  <a href="tel:+6565389978" style="color: #333333; text-decoration: underline;">+65 6538 9978</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                <strong>Leaf to Life &reg;</strong> by Sebastian Liew Centre Pte Ltd
              </p>
              <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                320 Serangoon Road, Centrium square, #11-10, Singapore 218108
              </p>
              <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                UEN: 202527780C
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 10px;">
                This is an automated email. Please do not reply directly to this message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailOptions: EmailOptions = {
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} - Leaf to Life`,
      html,
      attachments: [
        {
          filename: path.basename(invoicePath),
          path: invoicePath,
        },
      ],
    };

    return this.sendEmail(emailOptions);
  }

  isEnabled(): boolean {
    this.initialize(); // Ensure initialized before checking
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
