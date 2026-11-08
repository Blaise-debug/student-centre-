import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePostCursor, encodePostCursor, matchOwnedCourseUnit, normalizeCourseUnitKey, validatePostInput } from '../../src/utils/posts';

test('trims valid post input and course unit', () => {
  assert.deepEqual(validatePostInput({ courseUnit: ' BCS 214 ', text: ' Study group ' }, false), {
    valid: true,
    value: { courseUnit: 'BCS 214', text: 'Study group' },
  });
});

test('allows a media-only post but rejects blank post without media', () => {
  assert.equal(validatePostInput({ courseUnit: 'BCS 214', text: '' }, false).valid, false);
  assert.deepEqual(validatePostInput({ courseUnit: 'BCS 214', text: '' }, true), {
    valid: true,
    value: { courseUnit: 'BCS 214', text: '' },
  });
});

test('rejects malformed, incomplete, and oversized post input', () => {
  assert.equal(validatePostInput(null, false).valid, false);
  assert.equal(validatePostInput({ courseUnit: 123, text: 'post' }, false).valid, false);
  assert.equal(validatePostInput({ courseUnit: ' ', text: 'post' }, false).valid, false);
  assert.equal(validatePostInput({ courseUnit: 'BCS 214', text: 'x'.repeat(5001) }, false).valid, false);
});

test('matches requested unit names case-insensitively but returns the saved canonical name', () => {
  assert.equal(matchOwnedCourseUnit(['BCS 214', 'Communication Skills'], ' bcs 214 '), 'BCS 214');
  assert.equal(matchOwnedCourseUnit(['BCS 214'], 'BIT 210'), null);
  assert.equal(normalizeCourseUnitKey(' BCS 214 '), 'bcs 214');
});

test('encodes and validates stable feed cursors', () => {
  const createdAt = new Date('2026-11-08T09:30:00.000Z');
  const id = '507f1f77bcf86cd799439011';
  const encoded = encodePostCursor(createdAt, id);
  const decoded = decodePostCursor(encoded);

  assert.equal(decoded?.createdAt.toISOString(), createdAt.toISOString());
  assert.equal(decoded?.id, id);
  assert.equal(decodePostCursor('invalid'), null);
  assert.equal(decodePostCursor('x'.repeat(129)), null);
});
