import { Router } from 'express';
import { getUsers, getUserById, updateUserRole, toggleUserActive } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// Toate rutele necesită autentificare
router.use(authenticate);

// Doar admin poate vedea toți utilizatorii
router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin', 'project_manager'), getUserById);
router.patch('/:id/role', authorize('admin'), updateUserRole);
router.patch('/:id/toggle-active', authorize('admin'), toggleUserActive);

export default router;
