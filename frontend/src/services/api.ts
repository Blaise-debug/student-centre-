import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCAL_IP = '192.168.1.100';
const LOCAL_PORT = '5000';

// 1. Force string evaluation for Expo bundling
const ENV_URL = process.env.EXPO_PUBLIC_API_URL ? String(process.env.EXPO_PUBLIC_API_URL).trim() : '';

// 2. Determine base server origin dynamically
export const SERVER_BASE_URL = ENV_URL.length > 0
  ? ENV_URL.replace(/\/$/, '')
  : Platform.OS === 'android'
  ? `http://10.0.2.2:${LOCAL_PORT}`
  : `http://${LOCAL_IP}:${LOCAL_PORT}`;

export const API_BASE_URL = `${SERVER_BASE_URL}/api`;

// Debug log to confirm which URL Expo is actually hitting
console.log('[API Init] Active Server Base URL:', SERVER_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[API] Unauthorized — token may be expired');
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to construct valid absolute URLs for media/images returned by the backend.
 * Converts relative paths (e.g. "/uploads/image.jpg") or outdated Cloudflare URLs into valid active URLs.
 */
export function getMediaUrl(mediaPath?: string | null): string | null {
  if (!mediaPath) return null;

  // If the path is already relative (e.g. /uploads/abc.jpg)
  if (mediaPath.startsWith('/')) {
    return `${SERVER_BASE_URL}${mediaPath}`;
  }

  // If the stored URL points to an old/expired trycloudflare host, re-route it through the active origin
  if (mediaPath.includes('trycloudflare.com')) {
    const uploadsIndex = mediaPath.indexOf('/uploads');
    if (uploadsIndex !== -1) {
      const relativePath = mediaPath.substring(uploadsIndex);
      return `${SERVER_BASE_URL}${relativePath}`;
    }
  }

  return mediaPath;
}
