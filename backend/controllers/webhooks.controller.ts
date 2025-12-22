import { Request, Response } from 'express';
import { WebhookService } from '../services/WebhookService.js';
import type { FluentFormWebhookPayload } from '../types/webhook.js';

export class WebhooksController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  // Handle Fluent Forms Pro intake form webhook
  async handleFluentFormIntake(req: Request, res: Response): Promise<void> {
    try {
      const payload: FluentFormWebhookPayload = req.body;
      
      // Log the incoming webhook for debugging
      console.log('🔗 Fluent Forms webhook received:', {
        timestamp: new Date().toISOString(),
        formId: payload.form_id,
        submissionId: payload.serial_number,
        sourceUrl: payload.source_url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Process the webhook and create/update patient
      const result = await this.webhookService.processFluentFormIntake(payload);
      
      // Return success response
      res.status(200).json({
        success: true,
        message: 'Intake form processed successfully',
        patientId: result.patientId,
        action: result.action, // 'created' or 'updated'
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Fluent Forms webhook error:', error);
      
      // Return detailed error for debugging while maintaining security
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(400).json({
        success: false,
        error: 'Failed to process intake form',
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Health check endpoint for webhook testing
  async webhookHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        status: 'OK',
        service: 'Webhook Service',
        timestamp: new Date().toISOString(),
        endpoints: {
          fluentFormIntake: '/api/webhooks/fluent-forms/intake'
        }
      });
    } catch (error) {
      console.error('❌ Webhook health check error:', error);
      res.status(500).json({
        status: 'ERROR',
        message: 'Webhook service unavailable'
      });
    }
  }

  // Test endpoint for webhook validation
  async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('🧪 Test webhook called:', {
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        message: 'Test webhook received successfully',
        receivedData: {
          method: req.method,
          headers: Object.keys(req.headers),
          bodyType: typeof req.body,
          bodyKeys: typeof req.body === 'object' ? Object.keys(req.body) : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Test webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Test webhook failed'
      });
    }
  }
}