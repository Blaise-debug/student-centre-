//The conversation.routes.ts file

import { Router } from 'express';
import {
  createConversation,
  getMyConversations,
  getConversationById,
} from '../controllers/conversation.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, createConversation);
router.get('/', requireAuth, getMyConversations);
router.get('/:conversationId', requireAuth, getConversationById);

export default router;