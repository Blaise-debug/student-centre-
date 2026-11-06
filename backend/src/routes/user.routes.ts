import { Router } from 'express';
import { getUserProfile, updateOwnProfile, searchUsers } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/search', requireAuth, searchUsers);
router.get('/:userId', requireAuth, getUserProfile);
router.patch('/me', requireAuth, updateOwnProfile);

export default router;