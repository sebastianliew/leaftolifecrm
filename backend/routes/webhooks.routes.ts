import express, { type IRouter } from 'express';
import { WebhooksController } from '../controllers/webhooks.controller.js';
import {
  webhookRateLimit,
  webhookSecurity,
  fluentFormsSignature,
  webhookTimestamp,
  webhookLogger
} from '../middlewares/webhook.middleware.js';

const router: IRouter = express.Router();
const webhooksController = new WebhooksController();

// Apply webhook logging to all routes
router.use(webhookLogger);

// Health check endpoint for webhook monitoring (no security restrictions)
router.get('/health', webhooksController.webhookHealthCheck.bind(webhooksController));

// Test endpoint for webhook validation and debugging (with basic rate limiting)
router.all('/test', 
  webhookRateLimit,
  webhooksController.testWebhook.bind(webhooksController)
);

// Fluent Forms Pro intake form webhook with full security
// POST /api/webhooks/fluent-forms/intake
router.post('/fluent-forms/intake',
  webhookRateLimit,
  webhookSecurity({
    allowedIPs: [], // Configure in environment variables if needed
    requireUserAgent: true,
    maxBodySize: 2 * 1024 * 1024 // 2MB max
  }),
  webhookTimestamp(10), // 10 minute tolerance
  fluentFormsSignature(process.env.FLUENT_FORMS_SECRET_KEY),
  webhooksController.handleFluentFormIntake.bind(webhooksController)
);

// Additional webhook endpoints can be added here for other integrations
// Example: router.post('/typeform/intake', webhooksController.handleTypeformIntake.bind(webhooksController));
// Example: router.post('/gravity-forms/intake', webhooksController.handleGravityFormIntake.bind(webhooksController));

export default router;