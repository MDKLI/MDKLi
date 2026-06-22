import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { DoctorBranchInvitation } from '../entity/DoctorBranchInvitation';
import { DoctorBranchInvitationBranch } from '../entity/DoctorBranchInvitationBranch';
import { DoctorBranch } from '../entity/DoctorBranch';
import { Doctor } from '../entity/Doctor';
import { ClinicProfile } from '../entity/ClinicProfile';
import { Branch } from '../entity/Branch';
import { User } from '../entity/User';
import { InvitationStatus } from '../enums/invitation-status.enum';
import logger from '../utility/logger';

const invitationRepo = () => AppDataSource.getRepository(DoctorBranchInvitation);
const invitationBranchRepo = () => AppDataSource.getRepository(DoctorBranchInvitationBranch);
const doctorBranchRepo = () => AppDataSource.getRepository(DoctorBranch);
const doctorRepo = () => AppDataSource.getRepository(Doctor);
const clinicRepo = () => AppDataSource.getRepository(ClinicProfile);
const branchRepo = () => AppDataSource.getRepository(Branch);
const userRepo = () => AppDataSource.getRepository(User);

// Find doctors by email, name, or specialty
export const findDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, facilityId } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user owns the facility
    const facility = await clinicRepo().findOne({
      where: { id: facilityId as string },
      relations: ['user'],
    });

    if (!facility) {
      res.status(404).json({ message: 'Facility not found' });
      return;
    }

    if (facility.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this facility' });
      return;
    }

    // Only hospitals and centers can invite doctors
    if (facility.facility_type !== 'hospital' && facility.facility_type !== 'center') {
      res.status(403).json({ message: 'Only hospitals and medical centers can invite doctors' });
      return;
    }

    // Search for doctors
    const doctorsQuery = doctorRepo()
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.user', 'user')
      .where('doctor.is_active = :isActive', { isActive: true });

    if (query) {
      doctorsQuery.andWhere(
        '(user.email ILIKE :query OR doctor.full_name ILIKE :query)',
        { query: `%${query}%` }
      );
    }

    const doctors = await doctorsQuery.getMany();

    // Filter out doctors that already have pending/active invitations for this facility
    const existingInvitations = await invitationRepo().find({
      where: {
        facilityId: facilityId as string,
        status: InvitationStatus.PENDING,
      },
    });

    const invitedDoctorIds = new Set(existingInvitations.map(inv => inv.doctorId));

    const availableDoctors = doctors.filter(d => !invitedDoctorIds.has(d.id));

    res.json({
      success: true,
      data: availableDoctors.map(doctor => ({
        id: doctor.id,
        fullName: doctor.full_name,
        email: doctor.user?.email,
        specialty: doctor.specialty,
        yearsOfExperience: doctor.years_of_experience,
        photoUrl: doctor.photo_url,
        title: doctor.title,
        gender: doctor.gender,
      })),
    });
  } catch (error) {
    logger.error('Find doctors error:', error);
    res.status(500).json({ message: 'Failed to search doctors' });
  }
};

// Create a new invitation
export const createInvitation = async (req: Request, res: Response): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { doctorId, facilityId, branches, message } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user owns the facility
    const facility = await queryRunner.manager.findOne(ClinicProfile, {
      where: { id: facilityId },
      relations: ['user'],
    });

    if (!facility) {
      res.status(404).json({ message: 'Facility not found' });
      return;
    }

    if (facility.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this facility' });
      return;
    }

    // Only hospitals and centers can invite doctors
    if (facility.facility_type !== 'hospital' && facility.facility_type !== 'center') {
      res.status(403).json({ message: 'Only hospitals and medical centers can invite doctors' });
      return;
    }

    // Check if doctor exists
    const doctor = await queryRunner.manager.findOne(Doctor, {
      where: { id: doctorId },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor not found' });
      return;
    }

    // Check if there's already a pending invitation for this doctor and facility
    const existingInvitation = await queryRunner.manager.findOne(DoctorBranchInvitation, {
      where: {
        doctorId,
        facilityId,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      res.status(400).json({ message: 'An invitation is already pending for this doctor' });
      return;
    }

    // Check if doctor is already assigned to any of the selected branches
    const branchIds = branches.map((b: any) => b.branchId);
    const existingAssignments = await queryRunner.manager.find(DoctorBranch, {
      where: {
        doctorId,
        branchId: In(branchIds),
      },
    });

    if (existingAssignments.length > 0) {
      res.status(400).json({
        message: 'Doctor is already assigned to one or more of the selected branches',
      });
      return;
    }

    // Create the invitation
    const invitation = queryRunner.manager.create(DoctorBranchInvitation, {
      doctorId,
      facilityId,
      invitedByUserId: userId,
      status: InvitationStatus.PENDING,
      message,
    });

    await queryRunner.manager.save(invitation);

    // Create invitation branches
    for (const branchData of branches) {
      const branch = await queryRunner.manager.findOne(Branch, {
        where: { id: branchData.branchId },
      });

      if (!branch) {
        res.status(404).json({ message: `Branch ${branchData.branchId} not found` });
        return;
      }

      const invitationBranch = queryRunner.manager.create(DoctorBranchInvitationBranch, {
        invitationId: invitation.id,
        branchId: branchData.branchId,
        consultationFee: branchData.consultationFee,
      });

      await queryRunner.manager.save(invitationBranch);
    }

    await queryRunner.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitationId: invitation.id,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error('Create invitation error:', error);
    res.status(500).json({ message: 'Failed to create invitation' });
  } finally {
    await queryRunner.release();
  }
};

// Get invitations for a facility
export const getFacilityInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { facilityId } = req.params;
    const { status } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user owns the facility
    const facility = await clinicRepo().findOne({
      where: { id: facilityId },
      relations: ['user'],
    });

    if (!facility) {
      res.status(404).json({ message: 'Facility not found' });
      return;
    }

    if (facility.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this facility' });
      return;
    }

    // Build query
    const whereClause: any = { facilityId };
    if (status) {
      whereClause.status = status;
    }

    const invitations = await invitationRepo().find({
      where: whereClause,
      relations: ['doctor', 'doctor.user', 'invitationBranches', 'invitationBranches.branch'],
      order: { createdAt: 'DESC' },
    });

    res.json({
      success: true,
      data: invitations.map(invitation => ({
        id: invitation.id,
        doctor: {
          id: invitation.doctor.id,
          fullName: invitation.doctor.full_name,
          email: invitation.doctor.user?.email,
          specialty: invitation.doctor.specialty,
          photoUrl: invitation.doctor.photo_url,
          title: invitation.doctor.title,
        },
        branches: invitation.invitationBranches.map(ib => ({
          id: ib.branch.id,
          name: ib.branch.name,
          city: ib.branch.city,
          area: ib.branch.area,
          consultationFee: ib.consultationFee,
        })),
        status: invitation.status,
        message: invitation.message,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Get facility invitations error:', error);
    res.status(500).json({ message: 'Failed to get invitations' });
  }
};

// Get invitations for a doctor
export const getDoctorInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get doctor profile for this user
    const doctor = await doctorRepo().findOne({
      where: { user: { id: userId } },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor profile not found' });
      return;
    }

    // Build query
    const whereClause: any = { doctorId: doctor.id };
    if (status) {
      whereClause.status = status;
    }

    const invitations = await invitationRepo().find({
      where: whereClause,
      relations: ['facility', 'facility.user', 'invitationBranches', 'invitationBranches.branch', 'invitedBy'],
      order: { createdAt: 'DESC' },
    });

    res.json({
      success: true,
      data: invitations.map(invitation => ({
        id: invitation.id,
        facility: {
          id: invitation.facility.id,
          name: invitation.facility.clinic_name,
          photoUrl: invitation.facility.photo_url,
          facilityType: invitation.facility.facility_type,
          city: invitation.facility.city,
        },
        invitedBy: {
          id: invitation.invitedBy.id,
          username: invitation.invitedBy.username,
        },
        branches: invitation.invitationBranches.map(ib => ({
          id: ib.branch.id,
          name: ib.branch.name,
          city: ib.branch.city,
          area: ib.branch.area,
          consultationFee: ib.consultationFee,
        })),
        status: invitation.status,
        message: invitation.message,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Get doctor invitations error:', error);
    res.status(500).json({ message: 'Failed to get invitations' });
  }
};

// Accept invitation
export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { invitationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get doctor profile for this user
    const doctor = await queryRunner.manager.findOne(Doctor, {
      where: { user: { id: userId } },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor profile not found' });
      return;
    }

    // Get the invitation
    const invitation = await queryRunner.manager.findOne(DoctorBranchInvitation, {
      where: { id: invitationId },
      relations: ['invitationBranches', 'doctor'],
    });

    if (!invitation) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    // Check if the invitation belongs to this doctor
    if (invitation.doctor.id !== doctor.id) {
      res.status(403).json({ message: 'This invitation is not for you' });
      return;
    }

    // Check if invitation is still pending
    if (invitation.status !== InvitationStatus.PENDING) {
      res.status(400).json({ message: 'Invitation is no longer pending' });
      return;
    }

    // Create doctor_branch records for each branch
    for (const invitationBranch of invitation.invitationBranches) {
      // Check if doctor is already assigned to this branch
      const existingAssignment = await queryRunner.manager.findOne(DoctorBranch, {
        where: {
          doctorId: doctor.id,
          branchId: invitationBranch.branchId,
        },
      });

      if (existingAssignment) {
        res.status(400).json({
          message: 'You are already assigned to one or more of these branches',
        });
        return;
      }

      const doctorBranch = queryRunner.manager.create(DoctorBranch, {
        doctorId: doctor.id,
        branchId: invitationBranch.branchId,
        consultationFee: invitationBranch.consultationFee,
      });

      await queryRunner.manager.save(doctorBranch);
    }

    // Update invitation status
    invitation.status = InvitationStatus.ACCEPTED;
    await queryRunner.manager.save(invitation);

    await queryRunner.commitTransaction();

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error('Accept invitation error:', error);
    res.status(500).json({ message: 'Failed to accept invitation' });
  } finally {
    await queryRunner.release();
  }
};

// Reject invitation
export const rejectInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invitationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get doctor profile for this user
    const doctor = await doctorRepo().findOne({
      where: { user: { id: userId } },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor profile not found' });
      return;
    }

    // Get the invitation
    const invitation = await invitationRepo().findOne({
      where: { id: invitationId },
      relations: ['doctor'],
    });

    if (!invitation) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    // Check if the invitation belongs to this doctor
    if (invitation.doctor.id !== doctor.id) {
      res.status(403).json({ message: 'This invitation is not for you' });
      return;
    }

    // Check if invitation is still pending
    if (invitation.status !== InvitationStatus.PENDING) {
      res.status(400).json({ message: 'Invitation is no longer pending' });
      return;
    }

    // Update invitation status
    invitation.status = InvitationStatus.REJECTED;
    await invitationRepo().save(invitation);

    res.json({
      success: true,
      message: 'Invitation rejected',
    });
  } catch (error) {
    logger.error('Reject invitation error:', error);
    res.status(500).json({ message: 'Failed to reject invitation' });
  }
};

// Cancel invitation (for facility owners)
export const cancelInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invitationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get the invitation
    const invitation = await invitationRepo().findOne({
      where: { id: invitationId },
      relations: ['facility', 'facility.user'],
    });

    if (!invitation) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    // Check if user owns the facility
    if (invitation.facility.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this facility' });
      return;
    }

    // Check if invitation is still pending
    if (invitation.status !== InvitationStatus.PENDING) {
      res.status(400).json({ message: 'Invitation is no longer pending' });
      return;
    }

    // Update invitation status
    invitation.status = InvitationStatus.CANCELLED;
    await invitationRepo().save(invitation);

    res.json({
      success: true,
      message: 'Invitation cancelled',
    });
  } catch (error) {
    logger.error('Cancel invitation error:', error);
    res.status(500).json({ message: 'Failed to cancel invitation' });
  }
};

// Get facility branches for invitation
export const getFacilityBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { facilityId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user owns the facility
    const facility = await clinicRepo().findOne({
      where: { id: facilityId },
      relations: ['user'],
    });

    if (!facility) {
      res.status(404).json({ message: 'Facility not found' });
      return;
    }

    if (facility.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this facility' });
      return;
    }

    // Only hospitals and centers can invite doctors
    if (facility.facility_type !== 'hospital' && facility.facility_type !== 'center') {
      res.status(403).json({ message: 'Only hospitals and medical centers can invite doctors' });
      return;
    }

    // Get branches for this facility's user
    const branches = await branchRepo().find({
      where: { user: { id: facility.user.id } },
    });

    res.json({
      success: true,
      data: branches.map(branch => ({
        id: branch.id,
        name: branch.name,
        city: branch.city,
        area: branch.area,
        address: branch.address,
      })),
    });
  } catch (error) {
    logger.error('Get facility branches error:', error);
    res.status(500).json({ message: 'Failed to get branches' });
  }
};

// Get doctor's facility branches (from accepted invitations)
export const getDoctorFacilityBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get doctor profile
    const doctor = await doctorRepo().findOne({
      where: { user: { id: userId } },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor profile not found' });
      return;
    }

    // Get all facility branches for this doctor (from accepted invitations)
    const doctorBranches = await doctorBranchRepo().find({
      where: { doctorId: doctor.id },
      relations: ['branch', 'branch.user'],
    });

    // Format the response
    const facilityBranches = await Promise.all(
      doctorBranches.map(async (db) => {
        // Get facility info from branch
        const branch = db.branch;
        const facility = await clinicRepo().findOne({
          where: { user: { id: branch.user.id } },
        });

        return {
          id: branch.id,
          name: branch.name,
          city: branch.city,
          area: branch.area,
          address: branch.address,
          phoneNumbers: branch.phone_numbers,
          consultationFee: db.consultationFee,
          facility: {
            id: facility?.id,
            name: facility?.clinic_name,
            facilityType: facility?.facility_type,
          },
          isFacilityBranch: true, // Flag to indicate this is a facility branch (not editable)
        };
      })
    );

    res.json({
      success: true,
      data: facilityBranches,
    });
  } catch (error) {
    logger.error('Get doctor facility branches error:', error);
    res.status(500).json({ message: 'Failed to get facility branches' });
  }
};

// Kick doctor from branch (for facility owners)
export const kickDoctorFromBranch = async (req: Request, res: Response): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { doctorId, branchId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Find the branch
    const branch = await queryRunner.manager.findOne(Branch, {
      where: { id: branchId },
      relations: ['user'],
    });

    if (!branch) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }

    // Check if user owns this branch
    if (branch.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this branch' });
      return;
    }

    // Get the facility from branch
    const facility = await queryRunner.manager.findOne(ClinicProfile, {
      where: { user: { id: branch.user.id } },
    });

    // Find and update the invitation to kicked status
    const invitation = await queryRunner.manager.findOne(DoctorBranchInvitation, {
      where: {
        doctorId,
        facilityId: facility?.id,
        status: InvitationStatus.ACCEPTED,
      },
    });

    if (invitation) {
      invitation.status = InvitationStatus.KICKED;
      await queryRunner.manager.save(invitation);
    }

    // Delete the doctor-branch assignment
    const result = await queryRunner.manager.delete(DoctorBranch, {
      doctorId,
      branchId,
    });

    if (result.affected === 0) {
      res.status(404).json({ message: 'Doctor is not assigned to this branch' });
      return;
    }

    await queryRunner.commitTransaction();

    res.json({
      success: true,
      message: 'Doctor removed from branch successfully',
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error('Kick doctor from branch error:', error);
    res.status(500).json({ message: 'Failed to remove doctor from branch' });
  } finally {
    await queryRunner.release();
  }
};

// Doctor leaves branch
export const leaveBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get doctor profile
    const doctor = await doctorRepo().findOne({
      where: { user: { id: userId } },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor profile not found' });
      return;
    }

    // Delete the doctor-branch assignment
    const result = await doctorBranchRepo().delete({
      doctorId: doctor.id,
      branchId,
    });

    if (result.affected === 0) {
      res.status(404).json({ message: 'You are not assigned to this branch' });
      return;
    }

    res.json({
      success: true,
      message: 'You have left the branch successfully',
    });
  } catch (error) {
    logger.error('Leave branch error:', error);
    res.status(500).json({ message: 'Failed to leave branch' });
  }
};

// Doctor leaves facility (all branches)
export const leaveFacility = async (req: Request, res: Response): Promise<void> => {
  try {
    const { facilityId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get doctor profile
    const doctor = await doctorRepo().findOne({
      where: { user: { id: userId } },
    });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor profile not found' });
      return;
    }

    // Get all branches for this facility
    const facility = await clinicRepo().findOne({
      where: { id: facilityId },
      relations: ['user'],
    });

    if (!facility) {
      res.status(404).json({ message: 'Facility not found' });
      return;
    }

    // Get all facility branches
    const branches = await branchRepo().find({
      where: { user: { id: facility.user.id } },
    });

    const branchIds = branches.map(b => b.id);

    // Delete all doctor-branch assignments for this facility
    const result = await doctorBranchRepo().delete({
      doctorId: doctor.id,
      branchId: In(branchIds),
    });

    res.json({
      success: true,
      message: `You have left the facility and been removed from ${result.affected} branches`,
    });
  } catch (error) {
    logger.error('Leave facility error:', error);
    res.status(500).json({ message: 'Failed to leave facility' });
  }
};

// Get doctors assigned to a branch
export const getBranchDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get the branch
    const branch = await branchRepo().findOne({
      where: { id: branchId },
      relations: ['user'],
    });

    if (!branch) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }

    // Check if user owns this branch
    if (branch.user.id !== userId) {
      res.status(403).json({ message: 'You do not own this branch' });
      return;
    }

    // Get all doctors assigned to this branch
    const doctorBranches = await doctorBranchRepo().find({
      where: { branchId },
      relations: ['doctor', 'doctor.user'],
    });

    // Format the response
    const doctors = doctorBranches.map((db) => ({
      id: db.doctor.id,
      fullName: db.doctor.full_name,
      email: db.doctor.user?.email,
      specialty: db.doctor.specialty,
      title: db.doctor.title,
      photoUrl: db.doctor.photo_url,
      consultationFee: db.consultationFee,
      assignedAt: db.createdAt,
    }));

    res.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    logger.error('Get branch doctors error:', error);
    res.status(500).json({ message: 'Failed to get branch doctors' });
  }
};
