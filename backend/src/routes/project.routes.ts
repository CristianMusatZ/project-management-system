import { Router } from 'express';
import { createProject, getProjects, getProjectById, updateProject, deleteProject } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', authorize('admin', 'project_manager'), createProject);
router.put('/:id', authorize('admin', 'project_manager'), updateProject);
router.delete('/:id', authorize('admin', 'project_manager'), deleteProject);

export default router;
