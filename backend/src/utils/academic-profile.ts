export interface AcademicProfileInput {
  country: string;
  institution: string;
  levelOfStudy: string;
  yearOfStudy: string;
  program: string;
  mainUnits: string[];
  commonUnits: string[];
  otherUnits: string[];
}

export type AcademicProfileValidation =
  | { valid: true; value: AcademicProfileInput; activeUnit: string }
  | { valid: false; error: string };

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) return null;
  return cleaned;
}

function cleanUnits(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;

  const units: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const unit = cleanText(item, 60);
    if (!unit) return null;
    const key = unit.toLocaleLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    units.push(unit);
  }
  return units;
}

export function validateAcademicProfileInput(input: unknown): AcademicProfileValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, error: 'Academic details are required.' };
  }

  const record = input as Record<string, unknown>;
  const country = cleanText(record.country, 80);
  const institution = cleanText(record.institution, 120);
  const levelOfStudy = cleanText(record.levelOfStudy, 40);
  const yearOfStudy = cleanText(record.yearOfStudy, 30);
  const program = cleanText(record.program, 120);
  const mainUnits = cleanUnits(record.mainUnits);
  const commonUnits = cleanUnits(record.commonUnits);
  const otherUnits = record.otherUnits === undefined ? [] : cleanUnits(record.otherUnits);

  if (!country || !institution || !levelOfStudy || !yearOfStudy || !program) {
    return { valid: false, error: 'Complete all academic details before continuing.' };
  }

  if (!mainUnits || !commonUnits || !otherUnits) {
    return { valid: false, error: 'Each unit list must contain at most 20 valid units.' };
  }

  if (mainUnits.length + commonUnits.length + otherUnits.length === 0) {
    return { valid: false, error: 'Add at least one course unit.' };
  }

  const allUnits = [...mainUnits, ...commonUnits, ...otherUnits];
  const uniqueUnits = new Set(allUnits.map((unit) => unit.toLocaleLowerCase()));
  if (uniqueUnits.size !== allUnits.length) {
    return { valid: false, error: 'A course unit cannot appear in both lists.' };
  }

  return {
    valid: true,
    value: { country, institution, levelOfStudy, yearOfStudy, program, mainUnits, commonUnits, otherUnits },
    activeUnit: mainUnits[0] || commonUnits[0] || otherUnits[0],
  };
}
