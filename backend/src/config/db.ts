import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGO_URI);
    console.log('[DB] MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Connection error after initial connect:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });
  } catch (error) {
    console.error('[DB] Initial connection failed:', error);
    process.exit(1);
  }
}