import { Router } from 'express';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getMyNotifications);
router.patch('/:notificationId/read', requireAuth, markNotificationRead);
router.patch('/read-all', requireAuth, markAllNotificationsRead);

export default router;