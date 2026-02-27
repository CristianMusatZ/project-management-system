import { Router } from 'express';
import { getSettings, updateSettings, getAuditLogs, getAuditActions } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

// Setări generale — GET oricine, PUT doar admin
router.get('/', getSettings);
router.put('/', authorize('admin'), updateSettings);

// Jurnal de activitate — doar admin
router.get('/audit-logs', authorize('admin'), getAuditLogs);
router.get('/audit-logs/actions', authorize('admin'), getAuditActions);

export default router;
