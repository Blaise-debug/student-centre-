import { Request, Response } from 'express';
import { AcademicProfile } from '../models/AcademicProfile';
import {
  saveAcademicProfile,
  toAcademicProfileDto,
  toSharedAcademicDetails,
} from '../services/academic-profile.service';
import { validateAcademicProfileInput } from '../utils/academic-profile';

export async function getMyAcademicProfile(req: Request, res: Response) {
  try {
    const profile = await AcademicProfile.findOne({ user: req.user?.userId });
    if (!profile) {
      return res.status(404).json({ message: 'Academic profile not found.' });
    }

    return res.status(200).json({ profile: toAcademicProfileDto(profile) });
  } catch (error) {
    console.error('[AcademicProfile] Get own profile error:', error);
    return res.status(500).json({ message: 'Unable to load the academic profile.' });
  }
}

export async function lookupCourseShareCode(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-F0-9]{16}$/.test(code)) {
      return res.status(400).json({ message: 'Enter a valid course code.' });
    }

    const profile = await AcademicProfile.findOne({ shareCode: code });
    if (!profile) {
      return res.status(404).json({ message: 'Course code not found.' });
    }

    // Share only course structure; never expose the contributing student's identity.
    return res.status(200).json({ details: toSharedAcademicDetails(profile) });
  } catch (error) {
    console.error('[AcademicProfile] Course code lookup error:', error);
    return res.status(500).json({ message: 'Unable to look up that course code.' });
  }
}

export async function completeAcademicProfile(req: Request, res: Response) {
  const validation = validateAcademicProfileInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const profile = await saveAcademicProfile(
      req.user!.userId,
      validation.value,
      validation.activeUnit
    );
    return res.status(200).json({ profile: toAcademicProfileDto(profile) });
  } catch (error) {
    console.error('[AcademicProfile] Complete onboarding error:', error);
    return res.status(500).json({ message: 'Unable to save the academic profile.' });
  }
}

export async function changeActiveUnit(req: Request, res: Response) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  if (!unit || unit.length > 60) {
    return res.status(400).json({ message: 'Choose a valid course unit.' });
  }

  try {
    const profile = await AcademicProfile.findOne({
      user: req.user?.userId,
      $or: [{ mainUnits: unit }, { commonUnits: unit }, { otherUnits: unit }],
    });

    if (!profile) {
      return res.status(404).json({ message: 'Course unit not found in your profile.' });
    }

    profile.activeUnit = unit;
    await profile.save();
    return res.status(200).json({ profile: toAcademicProfileDto(profile) });
  } catch (error) {
    console.error('[AcademicProfile] Change active unit error:', error);
    return res.status(500).json({ message: 'Unable to change the active course unit.' });
  }
}
