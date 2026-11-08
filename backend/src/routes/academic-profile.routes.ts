import { Router } from 'express';
import {
  changeActiveUnit,
  completeAcademicProfile,
  getMyAcademicProfile,
  lookupCourseShareCode,
} from '../controllers/academic-profile.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/me', getMyAcademicProfile);
router.post('/course-code/lookup', lookupCourseShareCode);
router.post('/complete', completeAcademicProfile);
router.patch('/active-unit', changeActiveUnit);

export default router;
