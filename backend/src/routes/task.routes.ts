import { Router } from 'express';
import { createTask, getTasksByProject, getTaskById, updateTask, deleteTask, addComment } from '../controllers/task.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin', 'project_manager'), createTask);
router.get('/project/:projectId', getTasksByProject);
router.get('/:id', getTaskById);
router.put('/:id', authorize('admin', 'project_manager', 'member'), updateTask);
router.delete('/:id', authorize('admin', 'project_manager'), deleteTask);
router.post('/:id/comments', authorize('admin', 'project_manager', 'member'), addComment);

export default router;
