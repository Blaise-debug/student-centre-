import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAcademicProfileInput } from '../../src/utils/academic-profile';

const validProfile = {
  country: ' Kenya ',
  institution: ' KeMU ',
  levelOfStudy: 'Undergraduate',
  yearOfStudy: 'Year 2',
  program: 'Software Engineering',
  mainUnits: [' BCS 214 '],
  commonUnits: ['Communication Skills'],
  otherUnits: ['Elective Research'],
};

test('normalizes profile strings and selects the first main unit by default', () => {
  const result = validateAcademicProfileInput(validProfile);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.value, {
    country: 'Kenya',
    institution: 'KeMU',
    levelOfStudy: 'Undergraduate',
    yearOfStudy: 'Year 2',
    program: 'Software Engineering',
    mainUnits: ['BCS 214'],
    commonUnits: ['Communication Skills'],
    otherUnits: ['Elective Research'],
  });
  assert.equal(result.activeUnit, 'BCS 214');
});

test('uses the first common unit when no main units were supplied', () => {
  const result = validateAcademicProfileInput({
    ...validProfile,
    mainUnits: [],
    commonUnits: ['Communication Skills'],
    otherUnits: [],
  });

  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.activeUnit, 'Communication Skills');
});

test('uses the first other unit when no main or common units were supplied', () => {
  const result = validateAcademicProfileInput({
    ...validProfile,
    mainUnits: [],
    commonUnits: [],
    otherUnits: ['Elective Research'],
  });

  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.activeUnit, 'Elective Research');
});

test('rejects a non-object profile and incomplete academic details', () => {
  assert.equal(validateAcademicProfileInput(null).valid, false);
  assert.equal(validateAcademicProfileInput([]).valid, false);
  assert.equal(validateAcademicProfileInput({ ...validProfile, institution: ' ' }).valid, false);
});

test('requires at least one valid unit and caps each unit list at twenty', () => {
  assert.equal(
    validateAcademicProfileInput({ ...validProfile, mainUnits: [], commonUnits: [], otherUnits: [] }).valid,
    false
  );
  assert.equal(
    validateAcademicProfileInput({ ...validProfile, mainUnits: Array(21).fill('Unit') }).valid,
    false
  );
  assert.equal(
    validateAcademicProfileInput({ ...validProfile, commonUnits: Array(21).fill('Unit') }).valid,
    false
  );
  assert.equal(
    validateAcademicProfileInput({ ...validProfile, otherUnits: Array(21).fill('Unit') }).valid,
    false
  );
});

test('rejects empty, overlong, and duplicate units, including cross-list duplicates', () => {
  assert.equal(validateAcademicProfileInput({ ...validProfile, mainUnits: [' '] }).valid, false);
  assert.equal(validateAcademicProfileInput({ ...validProfile, mainUnits: ['x'.repeat(61)] }).valid, false);
  assert.equal(validateAcademicProfileInput({ ...validProfile, mainUnits: ['BCS 214', 'bcs 214'] }).valid, false);
  assert.equal(
    validateAcademicProfileInput({ ...validProfile, commonUnits: [' bcs 214 '] }).valid,
    false
  );
  assert.equal(
    validateAcademicProfileInput({ ...validProfile, otherUnits: [' communication skills '] }).valid,
    false
  );
});
