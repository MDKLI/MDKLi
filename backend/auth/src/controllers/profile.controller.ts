import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entity/User';
import { PatientProfile } from '../entity/PatientProfile';
import { ClinicProfile } from '../entity/ClinicProfile';
import { Doctor } from '../entity/Doctor';
import { PharmacyProfile } from '../entity/PharmacyProfile';
import { Branch } from '../entity/Branch';
import { validationResult } from 'express-validator';
import logger from '../utility/logger';
import { publishBranchCreated, publishBranchUpdated, publishDoctorUpdated, publishFacilityUpdated } from '../services/event-publisher.service';

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as User;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let profile: any = null;
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
      case UserRole.ADMIN:
      case UserRole.SUPER_ADMIN:
        // Admins don't have a separate profile table, return basic user info
        profile = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
        break;
      case UserRole.ADMIN:
      case UserRole.SUPER_ADMIN:
        res.status(403).json({ message: 'Admins cannot update profile via this endpoint' });
        return;
      default:
        res.status(400).json({ message: 'Invalid user role' });
        return;
    }

    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    // Fetch branches for doctors and facilities
    let branches: Branch[] = [];
    if (user.role === UserRole.DOCTOR || user.role === UserRole.CLINIC_ADMIN || user.role === UserRole.PHARMACY_ADMIN) {
      const branchRepo = AppDataSource.getRepository(Branch);
      branches = await branchRepo.find({
        where: { user: { id: user.id } }
      });
    }

    // Transform data for frontend compatibility
    const responseData: any = {
      ...profile,
      branches: branches
    };
    
    // Convert is_smoker to proper string value for frontend
    if (user.role === UserRole.PATIENT && profile) {
      const patientProfile = profile as PatientProfile;
      if (typeof patientProfile.is_smoker === 'boolean') {
        // Convert boolean to string
        responseData.is_smoker = patientProfile.is_smoker ? 'yes' : 'no';
      } else if (patientProfile.is_smoker === 'false') {
        // Handle string 'false' that might have been saved incorrectly
        responseData.is_smoker = 'no';
      } else if (patientProfile.is_smoker === 'true') {
        responseData.is_smoker = 'yes';
      }
    }
    
    logger.info('getMyProfile response:', JSON.stringify(responseData, null, 2));
    
    res.json(responseData);
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
        
        // Map camelCase to snake_case (only fields that exist in PatientProfile entity)
        // Use ?? to allow empty strings (nullish coalescing), not || which treats empty string as falsy
        const updateData: any = {
          full_name: req.body.fullName ?? profile.full_name,
          photo_url: req.body.photoUrl ?? profile.photo_url,
          gender: req.body.gender ?? profile.gender,
          date_of_birth: req.body.dateOfBirth ?? profile.date_of_birth,
          blood_type: req.body.bloodType ?? profile.blood_type,
          is_smoker: req.body.isSmoker ?? profile.is_smoker,
          allergies: req.body.allergies ?? profile.allergies,
          current_medications: req.body.currentMedications ?? profile.current_medications,
          family_history: req.body.familyHistory ?? profile.family_history,
        };
        
        // Handle emergency contact fields
        if (req.body.emergencyContactName !== undefined || req.body.emergencyContactPhone !== undefined || req.body.emergencyContactEmail !== undefined) {
          updateData.emergency_contact = {
            name: req.body.emergencyContactName ?? profile.emergency_contact?.name ?? '',
            phone: req.body.emergencyContactPhone ?? profile.emergency_contact?.phone ?? '',
            email: req.body.emergencyContactEmail ?? profile.emergency_contact?.email ?? '',
          };
        } else if (req.body.emergencyContact) {
          updateData.emergency_contact = req.body.emergencyContact;
        }
        
        Object.assign(profile, updateData);
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
        
        // Map camelCase to snake_case
        const updateData: any = {
          clinic_name: req.body.facilityName || req.body.clinicName || profile.clinic_name,
          photo_url: req.body.photoUrl || profile.photo_url,
          phone_numbers: req.body.phoneNumber ? [req.body.phoneNumber] : profile.phone_numbers,
          city: req.body.city || profile.city,
          address: req.body.address || profile.address,
          description: req.body.bio || req.body.description || profile.description,
        };
        
        // Only update facility_type if provided (during onboarding/signup)
        if (req.body.facilityType) {
          updateData.facility_type = req.body.facilityType;
        }
        
        Object.assign(profile, updateData);
        await repo.save(profile);
        publishFacilityUpdated(profile.id, 'clinic').catch(err => {
          logger.error('Failed to publish facility.updated event:', err);
        });
        
        // Handle branches if provided
        if (req.body.branches) {
          await saveBranches(user.id, req.body.branches, res);
        }
        
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
        
        // Map camelCase to snake_case (all fields that exist in Doctor entity)
        const updateData = {
          full_name: req.body.fullName || profile.full_name,
          photo_url: req.body.photoUrl || profile.photo_url,
          phone_number: req.body.phoneNumber || profile.phone_number,
          specialty: req.body.specialty || profile.specialty,
          title: req.body.title || profile.title,
          gender: req.body.gender || profile.gender,
          years_of_experience: req.body.yearsOfExperience || profile.years_of_experience,
          has_private_practice: req.body.hasPrivatePractice !== undefined ? req.body.hasPrivatePractice : profile.has_private_practice,
          description: req.body.bio || req.body.description || profile.description,
        };
        
        Object.assign(profile, updateData);
        
        // Handle branches if provided
        if (req.body.branches) {
          await saveBranches(user.id, req.body.branches, res);
          
          // If doctor adds branches, they have private practice
          if (req.body.branches.length > 0 && !profile.has_private_practice) {
            profile.has_private_practice = true;
            logger.info(`Doctor ${user.id} added branches, automatically setting has_private_practice to true`);
          }
        }
        
        await repo.save(profile);
        publishDoctorUpdated(profile.id).catch(err => {   // ← ADD HERE
          logger.error('Failed to publish doctor.updated event:', err);
        });
        
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
        // Map camelCase to snake_case
        const updateData: any = {
          pharmacy_name: req.body.facilityName || req.body.pharmacyName || profile.pharmacy_name,
          photo_url: req.body.photoUrl || profile.photo_url,
          phone_numbers: req.body.phoneNumber ? [req.body.phoneNumber] : profile.phone_numbers,
          city: req.body.city || profile.city,
          address: req.body.address || profile.address,
          description: req.body.bio || req.body.description || profile.description,
        };
        
        // Only update facility_type if provided (during onboarding/signup)
        if (req.body.facilityType) {
          updateData.facility_type = req.body.facilityType;
        }
        
        Object.assign(profile, updateData);
        await repo.save(profile);
        publishFacilityUpdated(profile.id, 'pharmacy').catch(err => {
          logger.error('Failed to publish facility.updated event:', err);
        });
        
        // Handle branches if provided
        if (req.body.branches) {
          await saveBranches(user.id, req.body.branches, res);
        }
        
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

// Helper function to save/update branches
async function saveBranches(
  userId: string,
  branchesData: any[],
  res: Response
): Promise<void> {
  try {
    const branchRepo = AppDataSource.getRepository(Branch);
    
    // Get existing branches
    const existingBranches = await branchRepo.find({
      where: { user: { id: userId } }
    });
    
    // Delete branches that are not in the new list
    const newBranchIds = branchesData.map(b => b.id).filter(id => id);
    for (const existingBranch of existingBranches) {
      if (!newBranchIds.includes(existingBranch.id)) {
        await branchRepo.remove(existingBranch);
      }
    }
    
    // Create or update branches
    for (const branchData of branchesData) {
      let branch: Branch;
      let isExisting = false;
      
      // Check if ID looks like a UUID (has dashes and is 36 chars) vs frontend-generated timestamp
      const isUUID = branchData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchData.id);
      
      if (isUUID) {
        // Try to find existing branch
        const existing = await branchRepo.findOne({
          where: { id: branchData.id, user: { id: userId } }
        });
        if (existing) {
          branch = existing;
          isExisting = true;
        } else {
          branch = new Branch();
          branch.user = { id: userId } as User;
        }
      } else {
        // Create new branch (frontend-generated ID or no ID)
        branch = new Branch();
        branch.user = { id: userId } as User;
      }
      
      branch.name = branchData.name;
      branch.city = branchData.city || branchData.cityId;
      branch.area = branchData.area;
      branch.address = branchData.address;
      branch.google_maps_url = branchData.googleMapsUrl || branchData.google_maps_url;
      branch.phone_numbers = branchData.phoneNumbers || branchData.phone_numbers || [];
      branch.consultation_fee = branchData.consultationFee || branchData.consultation_fee;
      branch.media_urls = branchData.mediaUrls || branchData.media_urls || [];
      
      await branchRepo.save(branch);
      
      // Publish event to booking service
      if (isExisting) {
        // Update existing branch
        publishBranchUpdated(branch.id, userId).catch(err => {
          logger.error('Failed to publish branch.updated event:', err);
        });
      } else {
        // Create new branch
        publishBranchCreated(branch.id, userId).catch(err => {
          logger.error('Failed to publish branch.created event:', err);
        });
      }
    }
  } catch (error) {
    logger.error('Save branches error:', error);
  }
}

// Delete user account
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as User;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    
    // Find the user
    const userToDelete = await userRepo.findOne({
      where: { id: user.id }
    });
    
    if (!userToDelete) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Delete associated profile data based on role
    switch (user.role) {
      case UserRole.PATIENT: {
        const repo = AppDataSource.getRepository(PatientProfile);
        const profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (profile) {
          await repo.remove(profile);
        }
        break;
      }
      case UserRole.CLINIC_ADMIN: {
        const repo = AppDataSource.getRepository(ClinicProfile);
        const profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (profile) {
          await repo.remove(profile);
        }
        // Delete branches
        const branchRepo = AppDataSource.getRepository(Branch);
        const branches = await branchRepo.find({ where: { user: { id: user.id } } });
        await branchRepo.remove(branches);
        break;
      }
      case UserRole.DOCTOR: {
        const repo = AppDataSource.getRepository(Doctor);
        const profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (profile) {
          await repo.remove(profile);
        }
        // Delete branches
        const branchRepo = AppDataSource.getRepository(Branch);
        const branches = await branchRepo.find({ where: { user: { id: user.id } } });
        await branchRepo.remove(branches);
        break;
      }
      case UserRole.PHARMACY_ADMIN: {
        const repo = AppDataSource.getRepository(PharmacyProfile);
        const profile = await repo.findOne({ where: { user: { id: user.id } } });
        if (profile) {
          await repo.remove(profile);
        }
        // Delete branches
        const branchRepo = AppDataSource.getRepository(Branch);
        const branches = await branchRepo.find({ where: { user: { id: user.id } } });
        await branchRepo.remove(branches);
        break;
      }
    }

    // Delete the user
    await userRepo.remove(userToDelete);
    
    logger.info(`User ${user.id} (${user.username}) deleted their account`);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete a specific branch
export const deleteBranch = async (req: Request, res: Response): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const user = (req as any).user as User;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { branchId } = req.params;
    
    // Find the branch
    const branch = await queryRunner.manager.findOne(Branch, {
      where: { id: branchId, user: { id: user.id } }
    });
    
    if (!branch) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }
    
    // Delete related doctor_branch records first
    await queryRunner.manager.delete('doctor_branches', { branchId });
    
    // Delete related doctor_branch_invitation_branches records
    await queryRunner.manager.delete('doctor_branch_invitation_branches', { branchId });
    
    // Delete the branch
    await queryRunner.manager.remove(branch);
    
    await queryRunner.commitTransaction();
    
    logger.info(`Branch ${branchId} deleted by user ${user.id}`);
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error('Delete branch error:', error);
    res.status(500).json({ message: 'Failed to delete branch' });
  } finally {
    await queryRunner.release();
  }
};
