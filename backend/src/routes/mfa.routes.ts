import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { setupMFA, enableMFA, disableMFA, verifyMFA, getMFAStatus } from '../controllers/mfa.controller';

const router = Router();

// /api/mfa/verify — accesibil cu token-ul temporar (mfaPending), fără authorize
router.post('/verify', authenticate, verifyMFA);

// Restul endpoint-urilor necesită admin autentificat complet
router.use(authenticate);
router.use(authorize('admin'));

router.get('/status', getMFAStatus);
router.get('/setup', setupMFA);
router.post('/enable', enableMFA);
router.post('/disable', disableMFA);

export default router;
