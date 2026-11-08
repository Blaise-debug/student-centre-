import { api } from './api';
import { AcademicProfile } from '../types/models';

export type AcademicProfileDraft = Omit<AcademicProfile, 'id' | 'activeUnit' | 'shareCode'>;

export async function fetchAcademicProfile(): Promise<AcademicProfile> {
  const { data } = await api.get<{ profile: AcademicProfile }>('/academic-profile/me');
  return data.profile;
}

export async function lookupCourseCode(code: string): Promise<AcademicProfileDraft> {
  const { data } = await api.post<{ details: AcademicProfileDraft }>(
    '/academic-profile/course-code/lookup',
    { code }
  );
  return data.details;
}

export async function completeAcademicProfile(
  profile: AcademicProfileDraft
): Promise<AcademicProfile> {
  const { data } = await api.post<{ profile: AcademicProfile }>(
    '/academic-profile/complete',
    profile
  );
  return data.profile;
}

export async function updateActiveUnit(unit: string): Promise<AcademicProfile> {
  const { data } = await api.patch<{ profile: AcademicProfile }>(
    '/academic-profile/active-unit',
    { unit }
  );
  return data.profile;
}
