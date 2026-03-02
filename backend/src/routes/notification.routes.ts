import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteAllRead } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/read-all', deleteAllRead);
router.delete('/:id', deleteNotification);

export default router;
