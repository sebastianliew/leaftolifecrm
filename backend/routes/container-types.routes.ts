import express, { Request, Response, type IRouter } from 'express';
import { ContainerType } from '../models/ContainerType.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';

const router: IRouter = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

interface ContainerTypeDocument {
  _id: string;
  allowedUoms: unknown[];
  toObject(): Record<string, unknown>;
  [key: string]: unknown;
}

interface UomObject {
  abbreviation?: string;
  name?: string;
  [key: string]: unknown;
}

const transformContainerType = (containerType: ContainerTypeDocument) => {
  const containerTypeObject = containerType.toObject();
  const { _id, allowedUoms, ...rest } = containerTypeObject;
  
  const transformedUoms = Array.isArray(allowedUoms) ? allowedUoms.map((uom: unknown) => {
    if (typeof uom === 'string') {
      return uom;
    }
    if (uom && typeof uom === 'object') {
      const uomObj = uom as UomObject;
      return uomObj.abbreviation || uomObj.name || String(uom);
    }
    return String(uom);
  }) : [];
  
  return {
    id: String(_id),
    ...rest,
    allowedUoms: transformedUoms
  };
};

// GET /api/container-types - Get all container types (use inventory permissions)
router.get('/', requirePermission('inventory', 'canViewInventory'), async (req: Request, res: Response) => {
  try {
    const containerTypes = await ContainerType.find()
      .populate('allowedUoms', 'name abbreviation')
      .sort({ name: 1 });
    const transformedContainerTypes = containerTypes.map(ct => transformContainerType(ct as ContainerTypeDocument));
    return res.json(transformedContainerTypes);
  } catch (error: unknown) {
    console.error('Error fetching container types:', error);
    return res.status(500).json({ error: 'Failed to fetch container types' });
  }
});

// POST /api/container-types - Create a new container type (use inventory permissions)
router.post('/', requirePermission('inventory', 'canAddProducts'), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const containerType = new ContainerType(data);
    await containerType.save();
    await containerType.populate('allowedUoms', 'name abbreviation');

    return res.status(201).json(transformContainerType(containerType as ContainerTypeDocument));
  } catch (error: unknown) {
    console.error('Error creating container type:', error);
    return res.status(500).json({ error: 'Failed to create container type' });
  }
});

// GET /api/container-types/:id - Get a specific container type (use inventory permissions)
router.get('/:id', requirePermission('inventory', 'canViewInventory'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const containerType = await ContainerType.findById(id)
      .populate('allowedUoms', 'name abbreviation');

    if (!containerType) {
      return res.status(404).json({ error: 'Container type not found' });
    }

    return res.json(transformContainerType(containerType as ContainerTypeDocument));
  } catch (error: unknown) {
    console.error('Error fetching container type:', error);
    return res.status(500).json({ error: 'Failed to fetch container type' });
  }
});

// PUT /api/container-types/:id - Update a specific container type (use inventory permissions)
router.put('/:id', requirePermission('inventory', 'canEditProducts'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const containerType = await ContainerType.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true }
    ).populate('allowedUoms', 'name abbreviation');

    if (!containerType) {
      return res.status(404).json({ error: 'Container type not found' });
    }

    return res.json(transformContainerType(containerType as ContainerTypeDocument));
  } catch (error: unknown) {
    console.error('Error updating container type:', error);
    return res.status(500).json({ error: 'Failed to update container type' });
  }
});

// DELETE /api/container-types/:id - Delete a specific container type (use inventory permissions)
router.delete('/:id', requirePermission('inventory', 'canDeleteProducts'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const containerType = await ContainerType.findByIdAndDelete(id);

    if (!containerType) {
      return res.status(404).json({ error: 'Container type not found' });
    }

    return res.json({ message: 'Container type deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting container type:', error);
    return res.status(500).json({ error: 'Failed to delete container type' });
  }
});

export default router;