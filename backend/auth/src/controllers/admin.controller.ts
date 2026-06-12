import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { PatientProfile } from '../entity/PatientProfile';
import { ClinicProfile } from '../entity/ClinicProfile';
import { Doctor } from '../entity/Doctor';
import { PharmacyProfile } from '../entity/PharmacyProfile';

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId } });
  
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  let profile;
  switch (user.role) {
    case 'patient':
      profile = await AppDataSource.getRepository(PatientProfile).findOne({ 
        where: { user: { id: userId } } 
      });
      break;
    case 'clinic_admin':
      profile = await AppDataSource.getRepository(ClinicProfile).findOne({ 
        where: { user: { id: userId } } 
      });
      break;
    case 'doctor':
      profile = await AppDataSource.getRepository(Doctor).findOne({ 
        where: { user: { id: userId } }, 
        relations: ['clinic'] 
      });
      break;
    case 'pharmacy_admin':
      profile = await AppDataSource.getRepository(PharmacyProfile).findOne({ 
        where: { user: { id: userId } } 
      });
      break;
    default:
      res.status(400).json({ message: 'Invalid role' });
      return;
  }

  res.json({ user, profile });
};

export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const updateData = req.body;
  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId } });
  
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  let repo: any;
  let profile: any;

  switch (user.role) {
    case 'patient':
      repo = AppDataSource.getRepository(PatientProfile);
      profile = await repo.findOne({ where: { user: { id: userId } } });
      break;
    case 'clinic_admin':
      repo = AppDataSource.getRepository(ClinicProfile);
      profile = await repo.findOne({ where: { user: { id: userId } } });
      break;
    case 'doctor':
      repo = AppDataSource.getRepository(Doctor);
      profile = await repo.findOne({ where: { user: { id: userId } } });
      break;
    case 'pharmacy_admin':
      repo = AppDataSource.getRepository(PharmacyProfile);
      profile = await repo.findOne({ where: { user: { id: userId } } });
      break;
    default:
      res.status(400).json({ message: 'Invalid role' });
      return;
  }

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  Object.assign(profile, updateData);
  await repo.save(profile);
  res.json({ message: 'Profile updated', profile });
};
