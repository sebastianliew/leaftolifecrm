import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';

// Container type for type safety
interface ContainerItem {
  id: string;
  remaining: number;
  capacity: number;
  status: 'full' | 'partial' | 'empty' | 'oversold';
  openedAt?: Date;
  batchNumber?: string;
  expiryDate?: Date;
  notes?: string;
  saleHistory?: Array<{
    transactionRef: string;
    quantitySold: number;
    soldAt: Date;
    soldBy?: string;
  }>;
}

// Request interfaces
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface ContainerQueryParams {
  status?: 'full' | 'partial' | 'empty' | 'all';
  includeEmpty?: string;
}

interface CreateContainerRequest {
  quantity?: number;      // Number of containers to create (default: 1)
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
  capacity?: number;      // Override product's containerCapacity
}

interface UpdateContainerRequest {
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
  status?: 'full' | 'partial' | 'empty';
  remaining?: number;     // For manual adjustment
}

/**
 * Get all containers (bottles) for a product
 * GET /api/products/:productId/containers
 */
export const getProductContainers = async (
  req: Request<{ productId: string }, unknown, unknown, ContainerQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { status, includeEmpty } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId)
      .select('name sku containerCapacity containers unitOfMeasurement')
      .populate('unitOfMeasurement', 'name abbreviation');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    let containers = product.containers?.partial || [];

    // Filter by status
    if (status && status !== 'all') {
      containers = containers.filter((c: ContainerItem) => c.status === status);
    } else if (includeEmpty !== 'true') {
      // By default, exclude empty containers
      containers = containers.filter((c: ContainerItem) => c.status !== 'empty');
    }

    // Sort: active (partial) containers first, then by openedAt date
    containers.sort((a: ContainerItem, b: ContainerItem) => {
      if (a.status === 'partial' && b.status !== 'partial') return -1;
      if (b.status === 'partial' && a.status !== 'partial') return 1;
      const aDate = a.openedAt ? new Date(a.openedAt).getTime() : 0;
      const bDate = b.openedAt ? new Date(b.openedAt).getTime() : 0;
      return bDate - aDate; // Most recently opened first
    });

    res.json({
      success: true,
      data: {
        productId: product._id,
        productName: product.name,
        productSku: product.sku,
        containerCapacity: product.containerCapacity,
        unitOfMeasurement: product.unitOfMeasurement,
        fullContainers: product.containers?.full || 0,
        containers: containers.map((c: ContainerItem) => ({
          id: c.id,
          remaining: c.remaining,
          capacity: c.capacity,
          status: c.status,
          openedAt: c.openedAt,
          batchNumber: c.batchNumber,
          expiryDate: c.expiryDate,
          notes: c.notes,
          salesCount: c.saleHistory?.length || 0,
          lastSale: c.saleHistory?.length && c.saleHistory.length > 0
            ? c.saleHistory[c.saleHistory.length - 1].soldAt
            : null
        })),
        summary: {
          totalFull: product.containers?.full || 0,
          totalPartial: containers.filter((c: ContainerItem) => c.status === 'partial').length,
          totalEmpty: (product.containers?.partial || []).filter((c: ContainerItem) => c.status === 'empty').length,
          totalRemaining: containers.reduce((sum: number, c: ContainerItem) => sum + Math.max(0, c.remaining), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error getting product containers:', error);
    res.status(500).json({ error: 'Failed to get product containers' });
  }
};

/**
 * Get details for a specific container including sale history
 * GET /api/products/:productId/containers/:containerId
 */
export const getContainerDetails = async (
  req: Request<{ productId: string; containerId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { productId, containerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId)
      .select('name sku containerCapacity containers unitOfMeasurement')
      .populate('unitOfMeasurement', 'name abbreviation');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const container = product.containers?.partial?.find((c: ContainerItem) => c.id === containerId);

    if (!container) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        productId: product._id,
        productName: product.name,
        productSku: product.sku,
        unitOfMeasurement: product.unitOfMeasurement,
        container: {
          id: container.id,
          remaining: container.remaining,
          capacity: container.capacity,
          status: container.status,
          openedAt: container.openedAt,
          batchNumber: container.batchNumber,
          expiryDate: container.expiryDate,
          notes: container.notes,
          saleHistory: container.saleHistory || []
        }
      }
    });
  } catch (error) {
    console.error('Error getting container details:', error);
    res.status(500).json({ error: 'Failed to get container details' });
  }
};

/**
 * Get sale history for a specific container
 * GET /api/products/:productId/containers/:containerId/history
 */
export const getContainerSaleHistory = async (
  req: Request<{ productId: string; containerId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { productId, containerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId)
      .select('name sku containers');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const container = product.containers?.partial?.find((c: ContainerItem) => c.id === containerId);

    if (!container) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }

    // Sort sale history by date (newest first)
    const saleHistory = [...(container.saleHistory || [])].sort((a, b) => {
      const aDate = a.soldAt ? new Date(a.soldAt).getTime() : 0;
      const bDate = b.soldAt ? new Date(b.soldAt).getTime() : 0;
      return bDate - aDate;
    });

    res.json({
      success: true,
      data: {
        containerId: container.id,
        productName: product.name,
        productSku: product.sku,
        openedAt: container.openedAt,
        capacity: container.capacity,
        currentRemaining: container.remaining,
        totalSold: saleHistory.reduce((sum, s) => sum + s.quantitySold, 0),
        salesCount: saleHistory.length,
        saleHistory
      }
    });
  } catch (error) {
    console.error('Error getting container sale history:', error);
    res.status(500).json({ error: 'Failed to get container sale history' });
  }
};

/**
 * Create new container(s) for a product (e.g., when receiving stock)
 * POST /api/products/:productId/containers
 */
export const createContainer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { quantity = 1, batchNumber, expiryDate, notes, capacity } = req.body as CreateContainerRequest;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const containerCapacity = capacity || product.containerCapacity;

    if (!containerCapacity || containerCapacity <= 0) {
      res.status(400).json({
        error: 'Product does not have container capacity set. Please set containerCapacity on the product first.'
      });
      return;
    }

    // Initialize containers if needed
    if (!product.containers) {
      product.containers = { full: 0, partial: [] };
    }
    if (!Array.isArray(product.containers.partial)) {
      product.containers.partial = [];
    }

    // Add as full containers
    const numContainers = Math.max(1, Math.floor(quantity));
    product.containers.full = (product.containers.full || 0) + numContainers;

    // If batch/expiry info provided, create tracked entries
    // (These start as "full" status but we record them for tracking)
    const createdContainers: Array<{ id: string; batchNumber?: string; expiryDate?: Date }> = [];

    if (batchNumber || expiryDate) {
      for (let i = 0; i < numContainers; i++) {
        const containerId = `BOTTLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`;
        product.containers.partial.push({
          id: containerId,
          remaining: containerCapacity,
          capacity: containerCapacity,
          status: 'full',
          batchNumber,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          notes,
          saleHistory: []
        });
        // Decrement full count since we're tracking individually
        product.containers.full--;
        createdContainers.push({ id: containerId, batchNumber, expiryDate: expiryDate ? new Date(expiryDate) : undefined });
      }
    }

    // Update current stock
    product.currentStock = (product.currentStock || 0) + (numContainers * containerCapacity);
    product.availableStock = product.currentStock - (product.reservedStock || 0);

    await product.save();

    res.status(201).json({
      success: true,
      message: `Created ${numContainers} container(s)`,
      data: {
        productId: product._id,
        containersAdded: numContainers,
        newTotalFull: product.containers.full,
        trackedContainers: createdContainers,
        newCurrentStock: product.currentStock
      }
    });
  } catch (error) {
    console.error('Error creating container:', error);
    res.status(500).json({ error: 'Failed to create container' });
  }
};

/**
 * Update container information
 * PUT /api/products/:productId/containers/:containerId
 */
export const updateContainer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { productId, containerId } = req.params;
    const { batchNumber, expiryDate, notes, status, remaining } = req.body as UpdateContainerRequest;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const containerIndex = product.containers?.partial?.findIndex((c: ContainerItem) => c.id === containerId);

    if (containerIndex === undefined || containerIndex < 0) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }

    const container = product.containers.partial[containerIndex];

    // Update fields
    if (batchNumber !== undefined) container.batchNumber = batchNumber;
    if (expiryDate !== undefined) container.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
    if (notes !== undefined) container.notes = notes;
    if (status !== undefined) container.status = status;

    // Allow manual remaining adjustment (for inventory correction)
    if (remaining !== undefined) {
      const oldRemaining = container.remaining;
      container.remaining = remaining;

      // Recalculate current stock
      const fullContainers = product.containers?.full || 0;
      const partialSum = product.containers.partial.reduce((sum: number, p: ContainerItem) => sum + Math.max(0, p.remaining), 0);
      product.currentStock = (fullContainers * (product.containerCapacity || 0)) + partialSum;
      product.availableStock = product.currentStock - (product.reservedStock || 0);

      // Add note about manual adjustment
      if (!container.saleHistory) container.saleHistory = [];
      container.saleHistory.push({
        transactionRef: `ADJUSTMENT_${Date.now()}`,
        quantitySold: oldRemaining - remaining, // Negative if adding
        soldAt: new Date(),
        soldBy: req.user?.username || 'system'
      });
    }

    await product.save();

    res.json({
      success: true,
      message: 'Container updated successfully',
      data: {
        containerId: container.id,
        remaining: container.remaining,
        capacity: container.capacity,
        status: container.status,
        batchNumber: container.batchNumber,
        expiryDate: container.expiryDate,
        notes: container.notes
      }
    });
  } catch (error) {
    console.error('Error updating container:', error);
    res.status(500).json({ error: 'Failed to update container' });
  }
};

/**
 * Delete/archive a container
 * DELETE /api/products/:productId/containers/:containerId
 */
export const deleteContainer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { productId, containerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const containerIndex = product.containers?.partial?.findIndex((c: ContainerItem) => c.id === containerId);

    if (containerIndex === undefined || containerIndex < 0) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }

    const container = product.containers.partial[containerIndex];

    // Only allow deletion of empty containers or mark as empty
    if (container.remaining > 0) {
      // Mark as empty instead of deleting (preserve history)
      container.status = 'empty';
      container.remaining = 0;
      await product.save();

      res.json({
        success: true,
        message: 'Container marked as empty (history preserved)',
        data: { containerId: container.id }
      });
      return;
    }

    // Remove empty container
    product.containers.partial.splice(containerIndex, 1);
    await product.save();

    res.json({
      success: true,
      message: 'Container removed successfully',
      data: { containerId }
    });
  } catch (error) {
    console.error('Error deleting container:', error);
    res.status(500).json({ error: 'Failed to delete container' });
  }
};
