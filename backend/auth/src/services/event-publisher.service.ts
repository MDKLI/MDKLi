import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entity/User';
import { Doctor } from '../entity/Doctor';
import { ClinicProfile } from '../entity/ClinicProfile';
import { PharmacyProfile } from '../entity/PharmacyProfile';
import { Branch } from '../entity/Branch';
import { DoctorBranchInvitation } from '../entity/DoctorBranchInvitation';
import { rabbitMQService } from './rabbitmq.service';
import logger from '../utility/logger';

// Publish doctor events
export async function publishDoctorCreated(doctorId: string): Promise<void> {
  try {
    const doctorRepo = AppDataSource.getRepository(Doctor);
    const doctor = await doctorRepo.findOne({
      where: { id: doctorId },
      relations: ['user', 'clinic']
    });

    if (!doctor) {
      logger.warn(`Doctor ${doctorId} not found for publishing event`);
      return;
    }

    // Get branches
    const branchRepo = AppDataSource.getRepository(Branch);
    const branches = await branchRepo.find({
      where: { user: { id: doctor.user.id } }
    });

    const eventData = {
      id: doctor.id,
      user_id: doctor.user.id,
      full_name: doctor.full_name,
      title: doctor.title,
      specialty: doctor.specialty,
      years_of_experience: doctor.years_of_experience,
      gender: doctor.gender,
      description: doctor.description,
      photo_url: doctor.photo_url,
      phone_number: doctor.phone_number,
      city: doctor.clinic?.city,
      area: null,
      has_private_practice: doctor.has_private_practice,
      clinic_name: doctor.clinic?.clinic_name,
      clinic_type: doctor.clinic?.facility_type,
      branches: branches.map(b => ({
        id: b.id,
        name: b.name,
        city: b.city,
        area: b.area,
        address: b.address,
        phone_numbers: b.phone_numbers,
        consultation_fee: b.consultation_fee,
        branch_type: 'private_practice'
      })),
      verification_status: doctor.is_active ? 'verified' : 'pending'
    };

    await rabbitMQService.publishDoctorCreated(eventData);
    logger.info(`Published doctor.created event: ${doctorId}`);
  } catch (error) {
    logger.error(`Failed to publish doctor.created event: ${doctorId}`, error);
  }
}

export async function publishDoctorUpdated(doctorId: string): Promise<void> {
  try {
    const doctorRepo = AppDataSource.getRepository(Doctor);
    const doctor = await doctorRepo.findOne({
      where: { id: doctorId },
      relations: ['user', 'clinic']
    });

    if (!doctor) {
      logger.warn(`Doctor ${doctorId} not found for publishing event`);
      return;
    }

    // Get branches
    const branchRepo = AppDataSource.getRepository(Branch);
    const branches = await branchRepo.find({
      where: { user: { id: doctor.user.id } }
    });

    const eventData = {
      id: doctor.id,
      user_id: doctor.user.id,
      full_name: doctor.full_name,
      title: doctor.title,
      specialty: doctor.specialty,
      years_of_experience: doctor.years_of_experience,
      gender: doctor.gender,
      description: doctor.description,
      photo_url: doctor.photo_url,
      phone_number: doctor.phone_number,
      city: doctor.clinic?.city,
      area: null,
      has_private_practice: doctor.has_private_practice,
      clinic_name: doctor.clinic?.clinic_name,
      clinic_type: doctor.clinic?.facility_type,
      branches: branches.map(b => ({
        id: b.id,
        name: b.name,
        city: b.city,
        area: b.area,
        address: b.address,
        phone_numbers: b.phone_numbers,
        consultation_fee: b.consultation_fee,
        branch_type: 'private_practice'
      })),
      verification_status: doctor.is_active ? 'verified' : 'pending'
    };

    await rabbitMQService.publishDoctorUpdated(eventData);
    logger.info(`Published doctor.updated event: ${doctorId}`);
  } catch (error) {
    logger.error(`Failed to publish doctor.updated event: ${doctorId}`, error);
  }
}

export async function publishDoctorDeleted(doctorId: string): Promise<void> {
  try {
    await rabbitMQService.publishDoctorDeleted(doctorId);
    logger.info(`Published doctor.deleted event: ${doctorId}`);
  } catch (error) {
    logger.error(`Failed to publish doctor.deleted event: ${doctorId}`, error);
  }
}

// Publish facility events
export async function publishFacilityCreated(facilityId: string, type: 'clinic' | 'pharmacy'): Promise<void> {
  try {
    let facility: any;
    let eventData: any;

    if (type === 'clinic') {
      const repo = AppDataSource.getRepository(ClinicProfile);
      facility = await repo.findOne({ where: { id: facilityId }, relations: ['user'] });
      if (!facility) return;

      eventData = {
        id: facility.id,
        user_id: facility.user.id,
        facility_name: facility.clinic_name,
        facility_type: facility.facility_type,
        description: facility.description,
        photo_url: facility.photo_url,
        phone_numbers: facility.phone_numbers,
        address: facility.address,
        city: facility.city,
        area: null,
        status: facility.status,
        facility_role: facility.facility_type === 'pharmacy' ? 'pharmacy' : 'clinic'
      };
    } else {
      const repo = AppDataSource.getRepository(PharmacyProfile);
      facility = await repo.findOne({ where: { id: facilityId }, relations: ['user'] });
      if (!facility) return;

      eventData = {
        id: facility.id,
        user_id: facility.user.id,
        facility_name: facility.pharmacy_name,
        facility_type: 'pharmacy',
        description: facility.description,
        photo_url: facility.photo_url,
        phone_numbers: facility.phone_numbers,
        address: facility.address,
        city: facility.city,
        area: null,
        status: facility.status,
        facility_role: 'pharmacy'
      };
    }

    await rabbitMQService.publishFacilityCreated(eventData);
    logger.info(`Published facility.created event: ${facilityId}`);
  } catch (error) {
    logger.error(`Failed to publish facility.created event: ${facilityId}`, error);
  }
}

export async function publishFacilityUpdated(facilityId: string, type: 'clinic' | 'pharmacy'): Promise<void> {
  try {
    let facility: any;
    let eventData: any;

    if (type === 'clinic') {
      const repo = AppDataSource.getRepository(ClinicProfile);
      facility = await repo.findOne({ where: { id: facilityId }, relations: ['user'] });
      if (!facility) return;

      eventData = {
        id: facility.id,
        user_id: facility.user.id,
        facility_name: facility.clinic_name,
        facility_type: facility.facility_type,
        description: facility.description,
        photo_url: facility.photo_url,
        phone_numbers: facility.phone_numbers,
        address: facility.address,
        city: facility.city,
        area: null,
        status: facility.status,
        facility_role: facility.facility_type === 'pharmacy' ? 'pharmacy' : 'clinic'
      };
    } else {
      const repo = AppDataSource.getRepository(PharmacyProfile);
      facility = await repo.findOne({ where: { id: facilityId }, relations: ['user'] });
      if (!facility) return;

      eventData = {
        id: facility.id,
        user_id: facility.user.id,
        facility_name: facility.pharmacy_name,
        facility_type: 'pharmacy',
        description: facility.description,
        photo_url: facility.photo_url,
        phone_numbers: facility.phone_numbers,
        address: facility.address,
        city: facility.city,
        area: null,
        status: facility.status,
        facility_role: 'pharmacy'
      };
    }

    await rabbitMQService.publishFacilityUpdated(eventData);
    logger.info(`Published facility.updated event: ${facilityId}`);
  } catch (error) {
    logger.error(`Failed to publish facility.updated event: ${facilityId}`, error);
  }
}

export async function publishFacilityDeleted(facilityId: string): Promise<void> {
  try {
    await rabbitMQService.publishFacilityDeleted(facilityId);
    logger.info(`Published facility.deleted event: ${facilityId}`);
  } catch (error) {
    logger.error(`Failed to publish facility.deleted event: ${facilityId}`, error);
  }
}

// Publish branch events
export async function publishBranchCreated(branchId: string, userId: string): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Branch);
    const branch = await repo.findOne({ where: { id: branchId } });
    if (!branch) return;

    await rabbitMQService.publishBranchCreated({
      id: branch.id,
      user_id: userId,
      name: branch.name,
      city: branch.city,
      area: branch.area,
      address: branch.address,
      phone_numbers: branch.phone_numbers,
      consultation_fee: branch.consultation_fee
    });
    logger.info(`Published branch.created event: ${branchId}`);
  } catch (error) {
    logger.error(`Failed to publish branch.created event: ${branchId}`, error);
  }
}

export async function publishBranchUpdated(branchId: string, userId: string): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Branch);
    const branch = await repo.findOne({ where: { id: branchId } });
    if (!branch) return;

    await rabbitMQService.publishBranchUpdated({
      id: branch.id,
      user_id: userId,
      name: branch.name,
      city: branch.city,
      area: branch.area,
      address: branch.address,
      phone_numbers: branch.phone_numbers,
      consultation_fee: branch.consultation_fee
    });
    logger.info(`Published branch.updated event: ${branchId}`);
  } catch (error) {
    logger.error(`Failed to publish branch.updated event: ${branchId}`, error);
  }
}

export async function publishBranchDeleted(branchId: string): Promise<void> {
  try {
    await rabbitMQService.publishBranchDeleted(branchId);
    logger.info(`Published branch.deleted event: ${branchId}`);
  } catch (error) {
    logger.error(`Failed to publish branch.deleted event: ${branchId}`, error);
  }
}

// Publish invitation events
export async function publishInvitationAccepted(invitationId: string): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(DoctorBranchInvitation);
    const invitation = await repo.findOne({ 
      where: { id: invitationId },
      relations: ['doctor', 'facility']
    });
    if (!invitation) return;

    await rabbitMQService.publishInvitationAccepted({
      id: invitation.id,
      doctor_id: invitation.doctorId,
      facility_id: invitation.facilityId,
      status: invitation.status
    });
    logger.info(`Published invitation.accepted event: ${invitationId}`);
  } catch (error) {
    logger.error(`Failed to publish invitation.accepted event: ${invitationId}`, error);
  }
}

export async function publishInvitationRejected(invitationId: string): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(DoctorBranchInvitation);
    const invitation = await repo.findOne({ 
      where: { id: invitationId },
      relations: ['doctor', 'facility']
    });
    if (!invitation) return;

    await rabbitMQService.publishInvitationRejected({
      id: invitation.id,
      doctor_id: invitation.doctorId,
      facility_id: invitation.facilityId,
      status: invitation.status
    });
    logger.info(`Published invitation.rejected event: ${invitationId}`);
  } catch (error) {
    logger.error(`Failed to publish invitation.rejected event: ${invitationId}`, error);
  }
}
