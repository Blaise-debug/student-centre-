import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

const allowedMediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMediaTypes.has(file.mimetype)) {
      callback(new Error('Only JPEG, PNG, WebP, MP4, MOV, and WebM media are supported.'));
      return;
    }
    callback(null, true);
  },
});

export function receivePostMedia(req: Request, res: Response, next: NextFunction) {
  upload.single('media')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Photos and videos must be 15 MB or smaller.' });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: 'The attached media could not be processed.' });
    }
    return res.status(400).json({ message: 'Only JPEG, PNG, WebP, MP4, MOV, and WebM media are supported.' });
  });
}
