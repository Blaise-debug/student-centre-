import { Router } from 'express';
import { createPost, deletePost, getUnitPosts, updatePost } from '../controllers/post.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { postWriteRateLimit } from '../middleware/post-rate-limit.middleware';
import { receivePostMedia } from '../middleware/post-upload.middleware';

const router = Router();

router.use(requireAuth);
router.get('/', getUnitPosts);
router.post('/', postWriteRateLimit, receivePostMedia, createPost);
router.patch('/:postId', postWriteRateLimit, receivePostMedia, updatePost);
router.delete('/:postId', postWriteRateLimit, deletePost);

export default router;
