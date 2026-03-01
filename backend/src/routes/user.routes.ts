import { Router } from 'express';
import { getUsersList, createUser, getUsers, getUserById, updateUserRole, toggleUserActive, deleteUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// Toate rutele necesită autentificare
router.use(authenticate);

// Listă simplificată pentru dropdown-uri (admin + PM + viewer pentru rapoarte)
router.get('/list', authorize('admin', 'project_manager', 'viewer', 'member'), getUsersList);
// Creare utilizator nou (doar admin)
router.post('/', authorize('admin'), createUser);
// Doar admin poate vedea toți utilizatorii
router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin', 'project_manager'), getUserById);
router.patch('/:id/role', authorize('admin'), updateUserRole);
router.patch('/:id/toggle-active', authorize('admin'), toggleUserActive);
router.delete('/:id', authorize('admin'), deleteUser);

export default router;
