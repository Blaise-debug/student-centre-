import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { AcademicProfile, IAcademicProfile } from '../models/AcademicProfile';
import { User } from '../models/User';
import { AcademicProfileInput } from '../utils/academic-profile';

export interface AcademicProfileDto extends AcademicProfileInput {
  id: string;
  activeUnit: string;
  shareCode: string;
}

function createShareCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

export function toAcademicProfileDto(profile: IAcademicProfile): AcademicProfileDto {
  return {
    id: profile._id.toString(),
    country: profile.country,
    institution: profile.institution,
    levelOfStudy: profile.levelOfStudy,
    yearOfStudy: profile.yearOfStudy,
    program: profile.program,
    mainUnits: [...profile.mainUnits],
    commonUnits: [...profile.commonUnits],
    otherUnits: [...(profile.otherUnits || [])],
    activeUnit: profile.activeUnit,
    shareCode: profile.shareCode,
  };
}

export function toSharedAcademicDetails(profile: IAcademicProfile): AcademicProfileInput {
  return {
    country: profile.country,
    institution: profile.institution,
    levelOfStudy: profile.levelOfStudy,
    yearOfStudy: profile.yearOfStudy,
    program: profile.program,
    mainUnits: [...profile.mainUnits],
    commonUnits: [...profile.commonUnits],
    otherUnits: [...(profile.otherUnits || [])],
  };
}

export async function saveAcademicProfile(
  userId: string,
  input: AcademicProfileInput,
  activeUnit: string
): Promise<IAcademicProfile> {
  const userObjectId = new Types.ObjectId(userId);
  let profile = await AcademicProfile.findOne({ user: userObjectId });

  if (!profile) {
    for (let attempt = 0; attempt < 3 && !profile; attempt += 1) {
      try {
        profile = await AcademicProfile.create({
          user: userObjectId,
          ...input,
          activeUnit,
          shareCode: createShareCode(),
        });
      } catch (error) {
        const isDuplicate =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 11000;

        if (!isDuplicate) throw error;
        profile = await AcademicProfile.findOne({ user: userObjectId });
      }
    }
  }

  if (!profile) {
    throw new Error('ACADEMIC_PROFILE_CREATE_FAILED');
  }

  profile.set({ ...input, activeUnit });
  await profile.save();

  const userUpdate = await User.updateOne(
    { _id: userObjectId, isVerified: true },
    { $set: { onboardingComplete: true } }
  );
  if (userUpdate.matchedCount !== 1) {
    throw new Error('ACADEMIC_PROFILE_ACCOUNT_UPDATE_FAILED');
  }

  return profile;
}
