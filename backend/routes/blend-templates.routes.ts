import { Router, Request, Response, type IRouter } from 'express';
import { BlendTemplateService } from '../services/BlendTemplateService.js';
import type { CreateBlendTemplateData, TemplateFilters } from '../types/blend.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';

const router: IRouter = Router();
const blendTemplateService = new BlendTemplateService();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/blend-templates - Get all blend templates with optional filters
router.get('/', requirePermission('blends', 'canViewFixedBlends'), async (req: Request, res: Response) => {
  try {
    const filters: TemplateFilters = {
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };

    const templates = await blendTemplateService.getTemplates(filters);
    return res.json(templates);
  } catch (error: unknown) {
    console.error('Error fetching blend templates:', error);
    return res.status(500).json({
      error: 'Failed to fetch blend templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/blend-templates/categories - Get template categories
router.get('/categories', requirePermission('blends', 'canViewFixedBlends'), async (req: Request, res: Response) => {
  try {
    const categories = await blendTemplateService.getCategories();
    return res.json(categories);
  } catch (error: unknown) {
    console.error('Error fetching blend template categories:', error);
    return res.status(500).json({
      error: 'Failed to fetch categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/blend-templates/:id - Get single blend template
router.get('/:id', requirePermission('blends', 'canViewFixedBlends'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await blendTemplateService.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Blend template not found' });
    }
    
    return res.json(template);
  } catch (error: unknown) {
    console.error('Error fetching blend template:', error);
    return res.status(500).json({
      error: 'Failed to fetch blend template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/blend-templates - Create new blend template
router.post('/', requirePermission('blends', 'canCreateFixedBlends'), async (req: Request, res: Response) => {
  try {
    const data: CreateBlendTemplateData = req.body;
    
    // Basic validation
    if (!data.name || !data.ingredients || data.ingredients.length === 0) {
      return res.status(400).json({
        error: 'Name and at least one ingredient are required'
      });
    }

    if (data.batchSize !== undefined && data.batchSize <= 0) {
      return res.status(400).json({
        error: 'Batch size must be greater than 0 when provided'
      });
    }

    if (!data.unitOfMeasurementId) {
      return res.status(400).json({
        error: 'Unit of measurement is required'
      });
    }

    if (!data.createdBy) {
      return res.status(400).json({
        error: 'Created by field is required'
      });
    }

    // Validate ingredients
    for (const ingredient of data.ingredients) {
      if (!ingredient.productId || !ingredient.name) {
        return res.status(400).json({
          error: 'Each ingredient must have a product ID and name'
        });
      }
      if (!ingredient.quantity || ingredient.quantity <= 0) {
        return res.status(400).json({
          error: 'Each ingredient must have a quantity greater than 0'
        });
      }
    }

    const template = await blendTemplateService.createTemplate(data);
    return res.status(201).json(template);
  } catch (error: unknown) {
    console.error('Error creating blend template:', error);
    return res.status(500).json({
      error: 'Failed to create blend template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/blend-templates/:id - Update blend template
router.put('/:id', requirePermission('blends', 'canEditFixedBlends'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const template = await blendTemplateService.updateTemplate(id, data);
    
    if (!template) {
      return res.status(404).json({ error: 'Blend template not found' });
    }
    
    return res.json(template);
  } catch (error: unknown) {
    console.error('Error updating blend template:', error);
    return res.status(500).json({
      error: 'Failed to update blend template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/blend-templates/:id - Delete blend template
router.delete('/:id', requirePermission('blends', 'canDeleteFixedBlends'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await blendTemplateService.deleteTemplate(id);
    return res.status(204).send();
  } catch (error: unknown) {
    console.error('Error deleting blend template:', error);
    return res.status(500).json({
      error: 'Failed to delete blend template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;