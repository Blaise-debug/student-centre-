import { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { UploadApiResponse } from 'cloudinary';
import { AcademicProfile } from '../models/AcademicProfile';
import { Post, IPost } from '../models/Post';
import { decodePostCursor, encodePostCursor, matchOwnedCourseUnit, normalizeCourseUnitKey, validatePostInput } from '../utils/posts';
import { cloudinary } from '../config/cloudinary';

const MAX_FEED_SIZE = 30;

function getProfileUnits(profile: { mainUnits: string[]; commonUnits: string[]; otherUnits?: string[] }) {
  return [...profile.mainUnits, ...profile.commonUnits, ...(profile.otherUnits || [])];
}

async function getOwnedCourseUnit(userId: string, requested: string) {
  const profile = await AcademicProfile.findOne({ user: userId }).select('mainUnits commonUnits otherUnits');
  if (!profile) return null;
  return matchOwnedCourseUnit(getProfileUnits(profile), requested);
}

function toPostDto(post: IPost & { author?: any }) {
  const author = post.author && typeof post.author === 'object' ? post.author : null;
  return {
    id: post._id.toString(),
    courseUnit: post.courseUnit,
    text: post.text,
    mediaUri: post.mediaUrl || '',
    mediaType: post.mediaResourceType || null,
    author: {
      id: author?._id?.toString() || '',
      displayName: author?.displayName || 'Student',
      username: author?.username || '',
      avatarUrl: author?.avatarUrl || '',
    },
    commentsCount: 0,
    challengesCount: 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function uploadMedia(file: Express.Multer.File): Promise<UploadApiResponse> {
  const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'student-centre/posts',
        resource_type: resourceType,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'],
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error('POST_MEDIA_UPLOAD_FAILED'));
          return;
        }
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

async function removeMedia(post: Pick<IPost, 'mediaPublicId' | 'mediaResourceType'>) {
  if (!post.mediaPublicId || !post.mediaResourceType) return;
  try {
    await cloudinary.uploader.destroy(post.mediaPublicId, {
      resource_type: post.mediaResourceType,
      invalidate: true,
    });
  } catch {
    // Database state is authoritative; a failed cleanup can be retried operationally.
    console.error('[Posts] Media cleanup failed');
  }
}

export async function getUnitPosts(req: Request, res: Response) {
  const requested = typeof req.query.unit === 'string' ? req.query.unit : '';
  if (!requested.trim() || requested.length > 60) {
    return res.status(400).json({ message: 'Choose a valid course unit.' });
  }

  try {
    const courseUnit = await getOwnedCourseUnit(req.user!.userId, requested);
    if (!courseUnit) {
      return res.status(404).json({ message: 'Course unit not found in your profile.' });
    }

    const cursorValue = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    const cursor = cursorValue ? decodePostCursor(cursorValue) : null;
    if (cursorValue && !cursor) return res.status(400).json({ message: 'Invalid posts page cursor.' });

    const filter = cursor ? {
      courseUnitKey: normalizeCourseUnitKey(courseUnit),
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ],
    } : { courseUnitKey: normalizeCourseUnitKey(courseUnit) };

    const result = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_FEED_SIZE + 1)
      .populate('author', 'displayName username avatarUrl')
      .exec();
    const hasMore = result.length > MAX_FEED_SIZE;
    const posts = result.slice(0, MAX_FEED_SIZE);
    const lastPost = posts[posts.length - 1];
    const nextCursor = hasMore && lastPost ? encodePostCursor(lastPost.createdAt, lastPost._id.toString()) : null;

    return res.status(200).json({
      posts: posts.map((post) => toPostDto(post as IPost & { author?: any })),
      nextCursor,
    });
  } catch (error) {
    console.error('[Posts] Feed load failed:', error);
    return res.status(500).json({ message: 'Unable to load posts for this course unit.' });
  }
}

export async function createPost(req: Request, res: Response) {
  const validation = validatePostInput(req.body, Boolean(req.file));
  if (!validation.valid) return res.status(400).json({ message: validation.error });

  let uploaded: UploadApiResponse | undefined;
  let createdPost: IPost | undefined;
  try {
    const courseUnit = await getOwnedCourseUnit(req.user!.userId, validation.value.courseUnit);
    if (!courseUnit) {
      return res.status(404).json({ message: 'Course unit not found in your profile.' });
    }

    if (req.file) {
      try {
        uploaded = await uploadMedia(req.file);
      } catch {
        return res.status(503).json({ message: 'Media upload is temporarily unavailable. Please try again.' });
      }
    }

    const post = await Post.create({
      author: new Types.ObjectId(req.user!.userId),
      courseUnit,
      courseUnitKey: normalizeCourseUnitKey(courseUnit),
      text: validation.value.text,
      mediaUrl: uploaded?.secure_url || '',
      mediaPublicId: uploaded?.public_id || '',
      mediaResourceType: uploaded?.resource_type === 'video' ? 'video' : uploaded ? 'image' : '',
    });
    createdPost = post;

    await post.populate('author', 'displayName username avatarUrl');
    return res.status(201).json({ post: toPostDto(post as IPost & { author?: any }) });
  } catch (error) {
    // If persistence failed after the remote upload, avoid leaving an orphaned asset.
    let safeToRemoveUpload = !createdPost;
    if (createdPost) {
      try {
        await Post.deleteOne({ _id: createdPost._id, author: req.user!.userId });
        safeToRemoveUpload = true;
      } catch {
        console.error('[Posts] Failed to roll back an incomplete post create');
      }
    }
    if (uploaded && safeToRemoveUpload) {
      await removeMedia({
        mediaPublicId: uploaded.public_id,
        mediaResourceType: uploaded.resource_type === 'video' ? 'video' : 'image',
      });
    }
    console.error('[Posts] Create failed:', error);
    return res.status(500).json({ message: 'Unable to publish this post.' });
  }
}

export async function updatePost(req: Request, res: Response) {
  const postId = typeof req.params.postId === 'string' ? req.params.postId : '';
  if (!Types.ObjectId.isValid(postId)) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  try {
    const post = await Post.findOne({ _id: postId, author: req.user!.userId });
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const validation = validatePostInput(
      { courseUnit: post.courseUnit, text: req.body?.text },
      Boolean(req.file) || Boolean(post.mediaUrl && req.body?.removeMedia !== 'true')
    );
    if (!validation.valid) return res.status(400).json({ message: validation.error });

    let uploaded: UploadApiResponse | undefined;
    if (req.file) {
      try {
        uploaded = await uploadMedia(req.file);
      } catch {
        return res.status(503).json({ message: 'Media upload is temporarily unavailable. Please try again.' });
      }
    }

    const previousMedia = post.mediaPublicId ? {
      mediaPublicId: post.mediaPublicId,
      mediaResourceType: post.mediaResourceType,
    } : null;
    post.text = validation.value.text;
    if (req.body?.removeMedia === 'true') {
      post.mediaUrl = '';
      post.mediaPublicId = '';
      post.mediaResourceType = '';
    }
    if (uploaded) {
      post.mediaUrl = uploaded.secure_url;
      post.mediaPublicId = uploaded.public_id;
      post.mediaResourceType = uploaded.resource_type === 'video' ? 'video' : 'image';
    }
    try {
      await post.save();
    } catch (error) {
      if (uploaded) {
        await removeMedia({
          mediaPublicId: uploaded.public_id,
          mediaResourceType: uploaded.resource_type === 'video' ? 'video' : 'image',
        });
      }
      throw error;
    }
    await post.populate('author', 'displayName username avatarUrl');

    if (previousMedia && (uploaded || req.body?.removeMedia === 'true')) {
      await removeMedia(previousMedia);
    }

    return res.status(200).json({ post: toPostDto(post as IPost & { author?: any }) });
  } catch (error) {
    console.error('[Posts] Update failed:', error);
    return res.status(500).json({ message: 'Unable to update this post.' });
  }
}

export async function deletePost(req: Request, res: Response) {
  const postId = typeof req.params.postId === 'string' ? req.params.postId : '';
  if (!Types.ObjectId.isValid(postId)) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  try {
    const post = await Post.findOneAndDelete({ _id: postId, author: req.user!.userId });
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    await removeMedia(post);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Posts] Delete failed:', error);
    return res.status(500).json({ message: 'Unable to delete this post.' });
  }
}
