import { Router } from 'express';
import { getLabels, createLabel, updateLabel, deleteLabel } from '../controllers/label.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', getLabels);
router.post('/', authorize('admin'), createLabel);
router.put('/:id', authorize('admin'), updateLabel);
router.delete('/:id', authorize('admin'), deleteLabel);

export default router;
