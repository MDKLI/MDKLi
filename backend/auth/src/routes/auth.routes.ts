import { Router } from 'express';
import { registerUser, loginUser, setupTOTP, verifyOTPForTOTP, changePassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { body } from 'express-validator';

const router = Router();

router.post(
  '/register',
  [
    body('username').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['patient', 'clinic_admin', 'doctor', 'pharmacy_admin']),
    body('profileData').isObject()
  ],
  registerUser
);

router.post(
  '/login',
  [
    body('username').isString().notEmpty(),
    body('password').isString().notEmpty(),
    body('otp').optional().isString()
  ],
  loginUser
);

router.post('/2fa/setup/:userId', setupTOTP);
router.post('/2fa/verify/:userId', [body('token').isString()], verifyOTPForTOTP);
router.post('/change-password', authMiddleware, [body('oldPassword').isString(), body('newPassword').isLength({ min: 6 })], changePassword);

export default router;
