import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth.routes';
import academicProfileRoutes from './routes/academic-profile.routes';
import userRoutes from './routes/user.routes';
import conversationRoutes from './routes/conversation.routes';
import messageRoutes from './routes/message.routes';
import notificationRoutes from './routes/notification.routes';
import postRoutes from './routes/post.routes';
import { errorHandler } from './middleware/error.middleware';

const app: Application = express();

// Configure Helmet to allow cross-origin image loading in React Native
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Resolve uploads directory safely across ts-node, dev, and production builds
const uploadsDir = fs.existsSync(path.join(__dirname, '../uploads'))
  ? path.join(__dirname, '../uploads')
  : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded media statically
app.use('/uploads', express.static(uploadsDir));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/academic-profile', academicProfileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);

app.use(errorHandler);

export default app;
