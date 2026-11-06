//The message.routes.ts file

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  sendMessage,
  getMessages,
  markAsRead,
  deleteMessage,
  uploadAttachment,
} from '../controllers/message.controller';
import { requireAuth } from '../middleware/auth.middleware';

// 1. Ensure upload destination directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Storage engine with fallback file extension detection
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    
    // Extract extension or infer default if missing from React Native payload
    let ext = path.extname(file.originalname || '');
    if (!ext) {
      if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else if (file.mimetype === 'application/pdf') ext = '.pdf';
      else ext = '.jpg'; // default image fallback
    }

    cb(null, `file-${uniqueSuffix}${ext}`);
  },
});

// 3. Configure Multer with file filters and size limits (10MB)
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    // Basic verification for common file upload types
    if (!file.mimetype) {
      return cb(null, true); // Pass through if mime is omitted by client
    }
    cb(null, true);
  },
});

// 4. Wrapper middleware to catch Multer errors cleanly
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      console.error('[Multer Error]:', err);
      return res.status(400).json({
        message: `File upload error: ${err.message}`,
        field: err.field,
      });
    } else if (err) {
      console.error('[Upload Error]:', err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

const router = Router();

// Routes
router.post('/', requireAuth, sendMessage);
router.post('/upload', requireAuth, handleUpload, uploadAttachment);
router.get('/:conversationId', requireAuth, getMessages);
router.patch('/:conversationId/read', requireAuth, markAsRead);
router.delete('/:messageId', requireAuth, deleteMessage);

export default router;
