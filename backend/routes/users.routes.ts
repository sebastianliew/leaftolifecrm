import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserPassword,
  deleteUser,
} from '@backend/controllers/users.controller.js';
import { authenticateToken } from '@backend/middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';

const router: ExpressRouter = Router();

router.use(authenticateToken);

router.get('/', requirePermission('userManagement', 'canViewUsers'), getAllUsers);

router.post('/', requirePermission('userManagement', 'canCreateUsers'), createUser);

router.get('/:id', requirePermission('userManagement', 'canViewUsers'), getUserById);

router.put('/:id', requirePermission('userManagement', 'canEditUsers'), updateUser);

router.patch('/:id/role', requirePermission('userManagement', 'canEditUsers'), updateUserRole);

router.patch('/:id/password', updateUserPassword);

router.delete('/:id', requirePermission('userManagement', 'canDeleteUsers'), deleteUser);

export default router;