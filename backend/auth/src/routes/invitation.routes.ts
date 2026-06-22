import { Router } from 'express';
import { body } from 'express-validator';
import {
  findDoctors,
  createInvitation,
  getFacilityInvitations,
  getDoctorInvitations,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  getFacilityBranches,
  getDoctorFacilityBranches,
  kickDoctorFromBranch,
  leaveBranch,
  leaveFacility,
  getBranchDoctors,
} from '../controllers/invitation.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Find doctors (for facilities)
router.get('/doctors/search', findDoctors);

// Get facility branches for invitation
router.get('/facility/:facilityId/branches', getFacilityBranches);

// Create invitation
router.post(
  '/',
  [
    body('doctorId').isUUID(),
    body('facilityId').isUUID(),
    body('branches').isArray({ min: 1 }),
    body('branches.*.branchId').isUUID(),
    body('branches.*.consultationFee').isNumeric(),
    body('message').optional().isString(),
  ],
  createInvitation
);

// Get facility invitations
router.get('/facility/:facilityId', getFacilityInvitations);

// Get doctor invitations
router.get('/doctor', getDoctorInvitations);

// Accept invitation
router.post('/:invitationId/accept', acceptInvitation);

// Reject invitation
router.post('/:invitationId/reject', rejectInvitation);

// Cancel invitation (for facility owners)
router.post('/:invitationId/cancel', cancelInvitation);

// Get doctor's facility branches (from accepted invitations)
router.get('/my-branches', getDoctorFacilityBranches);

// Kick doctor from branch (for facility owners)
router.post('/kick', [
  body('doctorId').isUUID(),
  body('branchId').isUUID(),
], kickDoctorFromBranch);

// Doctor leaves branch
router.post('/leave', [
  body('branchId').isUUID(),
], leaveBranch);

// Doctor leaves facility (all branches)
router.post('/leave-facility', [
  body('facilityId').isUUID(),
], leaveFacility);

// Get doctors assigned to a branch
router.get('/branch/:branchId/doctors', getBranchDoctors);

export default router;
