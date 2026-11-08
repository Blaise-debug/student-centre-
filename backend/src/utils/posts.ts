export interface PostInput {
  courseUnit: string;
  text: string;
}

export type PostInputResult =
  | { valid: true; value: PostInput }
  | { valid: false; error: string };

export interface PostCursor {
  createdAt: Date;
  id: string;
}

export function validatePostInput(body: unknown, hasMedia: boolean): PostInputResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Invalid post.' };
  }

  const input = body as Record<string, unknown>;
  if (typeof input.courseUnit !== 'string') {
    return { valid: false, error: 'Choose a course unit for this post.' };
  }

  const courseUnit = input.courseUnit.trim();
  if (!courseUnit || courseUnit.length > 60) {
    return { valid: false, error: 'Choose a valid course unit.' };
  }

  if (typeof input.text !== 'string') {
    return { valid: false, error: 'Post text must be plain text.' };
  }

  const text = input.text.trim();
  if (text.length > 5000) {
    return { valid: false, error: 'Post text must be 5,000 characters or fewer.' };
  }
  if (!text && !hasMedia) {
    return { valid: false, error: 'Write something or attach a photo or video.' };
  }

  return { valid: true, value: { courseUnit, text } };
}

export function matchOwnedCourseUnit(units: string[], requestedUnit: string): string | null {
  const normalizedRequest = requestedUnit.trim().toLocaleLowerCase();
  if (!normalizedRequest) return null;
  return units.find((unit) => unit.toLocaleLowerCase() === normalizedRequest) || null;
}

export function normalizeCourseUnitKey(unit: string): string {
  return unit.trim().toLowerCase();
}

export function encodePostCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodePostCursor(cursor: string): PostCursor | null {
  if (!cursor || cursor.length > 128) return null;
  try {
    const [timestamp, id, extra] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const createdAt = new Date(timestamp);
    if (extra !== undefined || !Number.isFinite(createdAt.getTime()) || !/^[a-f0-9]{24}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
