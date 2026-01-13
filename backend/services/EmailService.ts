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

  constructor() {
    // Don't initialize in constructor - wait for explicit call
  }

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
    const paymentStatusColor = isPaid ? '#10b981' : '#f59e0b';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Leaf to Life
              </h1>
              <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 14px;">
                Sebastian Liew Centre Ltd.
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                Hello ${customerName},
              </h2>

              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for your purchase! Your invoice is attached to this email.
              </p>

              <!-- Invoice Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">
                          Invoice Number:
                        </td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: 600;">
                          ${invoiceNumber}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">
                          Date:
                        </td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: 600;">
                          ${formatDate(transactionDate)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">
                          Total Amount:
                        </td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 18px; font-weight: 700;">
                          ${formatCurrency(transactionAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">
                          Status:
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="background-color: ${paymentStatusColor}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                            ${paymentStatusText}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${!isPaid ? `
              <!-- Payment Required Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>Payment Required:</strong> Please complete your payment using PayNow or Bank Transfer. Payment details are included in the attached invoice.
                </p>
              </div>

              <!-- Payment Methods -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                  Payment Methods
                </h3>

                <div style="background-color: #eff6ff; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                  <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 14px;">
                    PayNow (UEN)
                  </p>
                  <p style="margin: 0; color: #1e3a8a; font-size: 14px;">
                    UEN: <strong>202527780C</strong><br>
                    Company: Leaf to Life Pte Ltd
                  </p>
                </div>

                <div style="background-color: #eff6ff; padding: 16px; border-radius: 6px;">
                  <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 14px;">
                    Bank Transfer
                  </p>
                  <p style="margin: 0; color: #1e3a8a; font-size: 14px;">
                    Account: <strong>0721361590</strong><br>
                    Bank: DBS Bank (Singapore)<br>
                    Account Name: Leaf to Life Pte Ltd
                  </p>
                </div>
              </div>
              ` : `
              <!-- Payment Confirmed -->
              <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.5;">
                  <strong>Payment Confirmed:</strong> Thank you for your payment. Your transaction has been completed successfully.
                </p>
              </div>
              `}

              <!-- Attached Invoice -->
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                Your detailed invoice is attached as a PDF file to this email.
              </p>

              <!-- Contact Information -->
              <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
                  Questions or Concerns?
                </h3>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  If you have any questions about this invoice, please contact us:
                </p>
                <p style="margin: 12px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  📧 <a href="mailto:customerservice@leaftolife.com.sg" style="color: #10b981; text-decoration: none;">customerservice@leaftolife.com.sg</a><br>
                  📞 <a href="tel:+6565389978" style="color: #10b981; text-decoration: none;">+65 6538 9978</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                <strong>Sebastian Liew Centre Ltd.</strong> (Leaf to Life)
              </p>
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                10 Sinaran Drive, #10-03 Novena Medical Center, Singapore 307506
              </p>
              <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                UEN: 202527780C
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
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

    return await this.sendEmail(emailOptions);
  }

  isEnabled(): boolean {
    this.initialize(); // Ensure initialized before checking
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
