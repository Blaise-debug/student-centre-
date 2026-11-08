import { api } from './api';

export interface PostDto {
  id: string;
  courseUnit: string;
  text: string;
  mediaUri: string;
  mediaType: 'image' | 'video' | null;
  author: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string;
  };
  commentsCount: number;
  challengesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostPage {
  posts: PostDto[];
  nextCursor: string | null;
}

export async function fetchUnitPosts(unit: string, cursor?: string | null): Promise<PostPage> {
  const { data } = await api.get<PostPage>('/posts', { params: { unit, ...(cursor ? { cursor } : {}) } });
  return data;
}

function addLocalMedia(form: FormData, mediaUri?: string) {
  if (!mediaUri) return;
  if (!mediaUri.startsWith('file://') && !mediaUri.startsWith('content://')) {
    throw new Error('Please select the media again before publishing.');
  }

  const path = mediaUri.split('?')[0];
  const extension = path.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeTypeByExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  };
  const type = mimeTypeByExtension[extension] || 'image/jpeg';
  form.append('media', {
    uri: mediaUri,
    name: `post-media-${Date.now()}.${mimeTypeByExtension[extension] ? extension : 'jpg'}`,
    type,
  } as any);
}

function createPostForm(courseUnit: string, text: string, mediaUri?: string, removeMedia = false) {
  const form = new FormData();
  form.append('courseUnit', courseUnit);
  form.append('text', text);
  if (removeMedia) form.append('removeMedia', 'true');
  addLocalMedia(form, mediaUri);
  return form;
}

const multipartHeaders = { headers: { 'Content-Type': 'multipart/form-data' } };

export async function createUnitPost(courseUnit: string, text: string, mediaUri?: string): Promise<PostDto> {
  const { data } = await api.post<{ post: PostDto }>(
    '/posts',
    createPostForm(courseUnit, text, mediaUri),
    multipartHeaders
  );
  return data.post;
}

export async function updateUnitPost(
  postId: string,
  courseUnit: string,
  text: string,
  mediaUri?: string,
  removeMedia = false
): Promise<PostDto> {
  const form = createPostForm(courseUnit, text, undefined, removeMedia);
  if (mediaUri?.startsWith('file://') || mediaUri?.startsWith('content://')) {
    addLocalMedia(form, mediaUri);
  }
  const { data } = await api.patch<{ post: PostDto }>(`/posts/${encodeURIComponent(postId)}`, form, multipartHeaders);
  return data.post;
}

export async function deleteUnitPost(postId: string): Promise<void> {
  await api.delete(`/posts/${encodeURIComponent(postId)}`);
}
