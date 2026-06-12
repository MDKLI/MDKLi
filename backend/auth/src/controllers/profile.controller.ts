import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entity/User';
import { PatientProfile } from '../entity/PatientProfile';
import { ClinicProfile } from '../entity/ClinicProfile';
import { Doctor } from '../entity/Doctor';
import { PharmacyProfile } from '../entity/PharmacyProfile';
import { validationResult } from 'express-validator';
import logger from '../utility/logger';

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as User;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let profile = null;
    switch (user.role) {
      case UserRole.PATIENT:
        profile = await AppDataSource.getRepository(PatientProfile).findOne({
          where: { user: { id: user.id } },
          relations: ['user']
        });
        break;
      case UserRole.CLINIC_ADMIN:
        profile = await AppDataSource.getRepository(ClinicProfile).findOne({
          where: { user: { id: user.id } },
          relations: ['user']
        });
        break;
      case UserRole.DOCTOR:
        profile = await AppDataSource.getRepository(Doctor).findOne({
          where: { user: { id: user.id } },
          relations: ['user', 'clinic']
        });
        break;
      case UserRole.PHARMACY_ADMIN:
        profile = await AppDataSource.getRepository(PharmacyProfile).findOne({
          where: { user: { id: user.id } },
          relations: ['user']
        });
        break;
      default:
        res.status(400).json({ message: 'Invalid user role' });
        return;
    }

    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    res.json(profile);
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const user = (req as any).user as User;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    switch (user.role) {
      case UserRole.PATIENT: {
        const repo = AppDataSource.getRepository(PatientProfile);
        let profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (!profile) {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
        Object.assign(profile, req.body);
        await repo.save(profile);
        res.json({ message: 'Profile updated', profile });
        return;
      }
      case UserRole.CLINIC_ADMIN: {
        const repo = AppDataSource.getRepository(ClinicProfile);
        let profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (!profile) {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
        Object.assign(profile, req.body);
        await repo.save(profile);
        res.json({ message: 'Profile updated', profile });
        return;
      }
      case UserRole.DOCTOR: {
        const repo = AppDataSource.getRepository(Doctor);
        let profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (!profile) {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
        Object.assign(profile, req.body);
        await repo.save(profile);
        res.json({ message: 'Profile updated', profile });
        return;
      }
      case UserRole.PHARMACY_ADMIN: {
        const repo = AppDataSource.getRepository(PharmacyProfile);
        let profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (!profile) {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
        Object.assign(profile, req.body);
        await repo.save(profile);
        res.json({ message: 'Profile updated', profile });
        return;
      }
      default:
        res.status(400).json({ message: 'Invalid user role' });
        return;
    }
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
