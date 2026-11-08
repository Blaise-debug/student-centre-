import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidPassword } from '../../src/utils/validators';

test('passwords require eight characters, a letter, and a number', () => {
  assert.equal(isValidPassword('abc12345'), true);
  assert.equal(isValidPassword('short1'), false);
  assert.equal(isValidPassword('passwordonly'), false);
  assert.equal(isValidPassword('12345678'), false);
});

test('passwords are rejected above bcrypt’s 72-byte input limit', () => {
  assert.equal(isValidPassword(`a1${'x'.repeat(70)}`), true);
  assert.equal(isValidPassword(`a1${'x'.repeat(71)}`), false);
  assert.equal(isValidPassword(`a1${'é'.repeat(36)}`), false);
});
