import { Request, Response } from 'express';
import { Supplier } from '../models/Supplier.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';

// Request interfaces
interface SupplierQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CreateSupplierRequest {
  name: string;
  code?: string;
  description?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  businessType?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'pending_approval' | 'blacklisted';
  isActive?: boolean;
  isPreferred?: boolean;
  requiresApproval?: boolean;
  creditLimit?: number;
}

interface UpdateSupplierRequest extends Partial<CreateSupplierRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const getSuppliers = async (req: Request<Record<string, never>, Record<string, never>, Record<string, never>, SupplierQueryParams>, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      status,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    interface SupplierQuery {
      $or?: Array<
        | { name: { $regex: string; $options: string } }
        | { code: { $regex: string; $options: string } }
        | { description: { $regex: string; $options: string } }
        | { contactPerson: { $regex: string; $options: string } }
        | { email: { $regex: string; $options: string } }
      >;
      status?: string;
      isActive?: boolean;
    }
    
    const query: SupplierQuery = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
      if (status === 'active') {
        query.isActive = true;
      }
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const suppliers = await Supplier.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);
      
    const total = await Supplier.countDocuments(query);

    // Transform suppliers to include id field and remove _id
    const transformedSuppliers = suppliers.map(supplier => ({
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    }));

    res.json({
      suppliers: transformedSuppliers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const getSupplierById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    
    // Transform supplier to include id field and remove _id
    const transformedSupplier = {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    };
    
    res.json(transformedSupplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
};

export const createSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supplierData = req.body as CreateSupplierRequest;
    
    // Check if supplier with same name or code exists
    const existingSupplier = await Supplier.findOne({
      $or: [
        { name: { $regex: `^${supplierData.name}$`, $options: 'i' } },
        ...(supplierData.code ? [{ code: supplierData.code }] : [])
      ]
    });
    
    if (existingSupplier) {
      res.status(400).json({ 
        error: existingSupplier.name.toLowerCase() === supplierData.name.toLowerCase() 
          ? 'Supplier with this name already exists' 
          : 'Supplier with this code already exists'
      });
      return;
    }
    
    const supplier = new Supplier({
      ...supplierData,
      isActive: supplierData.status === 'active' || supplierData.isActive,
      createdBy: req.user?._id || 'system',
      lastModifiedBy: req.user?._id || 'system'
    });
    
    await supplier.save();
    
    
    // Transform supplier to include id field and remove _id
    const transformedSupplier = {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    };
    
    res.status(201).json(transformedSupplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const updates = { ...req.body } as UpdateSupplierRequest;
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;
    
    // Check if name is being changed and if it conflicts
    if (updates.name) {
      const existingSupplier = await Supplier.findOne({ 
        name: { $regex: `^${updates.name}$`, $options: 'i' },
        _id: { $ne: req.params.id }
      });
      
      if (existingSupplier) {
        res.status(400).json({ error: 'Supplier with this name already exists' });
        return;
      }
    }
    
    // Check if code is being changed and if it conflicts
    if (updates.code) {
      const existingSupplier = await Supplier.findOne({ 
        code: updates.code,
        _id: { $ne: req.params.id }
      });
      
      if (existingSupplier) {
        res.status(400).json({ error: 'Supplier with this code already exists' });
        return;
      }
    }
    
    // Update isActive based on status
    const updatedFields = { 
      ...updates,
      lastModifiedBy: req.user?._id || 'system'
    } as typeof updates & { isActive?: boolean; lastModifiedBy: string };
    
    if (updates.status !== undefined) {
      updatedFields.isActive = updates.status === 'active';
    }
    
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      updatedFields,
      { new: true, runValidators: true }
    );
    
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    
    // Log activity
    if (req.user) {
      console.log(`Supplier updated by ${req.user.email}: ${supplier.name}`);
    }
    
    // Transform supplier to include id field and remove _id
    const transformedSupplier = {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    };
    
    res.json(transformedSupplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check if supplier has products
    const productCount = await Product.countDocuments({ supplier: req.params.id });
    
    if (productCount > 0) {
      res.status(400).json({ 
        error: `Cannot delete supplier. ${productCount} products are using this supplier.` 
      });
      return;
    }
    
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    
    // Log activity
    if (req.user) {
      console.log(`Supplier deleted by ${req.user.email}: ${supplier.name}`);
    }
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};