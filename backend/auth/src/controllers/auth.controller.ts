import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entity/User";
import { PatientProfile } from "../entity/PatientProfile";
import { ClinicProfile } from "../entity/ClinicProfile";
import { Doctor } from "../entity/Doctor";
import { PharmacyProfile } from "../entity/PharmacyProfile";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { validationResult } from "express-validator";
import logger from "../utility/logger";

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

const verifyOTP = async (otp: string, secret: string): Promise<boolean> => {
    try {   
        return speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: otp,
            window: 1
        });
    } catch (error) {
        logger.error('OTP verification error:', error);
        return false;
    }
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const { username, email, password, role, profileData } = req.body;

        const allowedRoles = ['patient', 'clinic_admin', 'doctor', 'pharmacy_admin'];
        if (!allowedRoles.includes(role)) {
            res.status(400).json({ message: 'Invalid role' });
            return;
        }

        const userRepository = queryRunner.manager.getRepository(User);
        const existingUser = await userRepository.findOne({ 
            where: [{ username }, { email }] 
        });
        if (existingUser) {
            res.status(400).json({ message: 'Username or email already exists' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = userRepository.create({
            username,
            email,
            passwordHash,
            role: role as UserRole,
        });
        await queryRunner.manager.save(user);

        switch (role) {
            case 'patient': {
                const patientProfile = new PatientProfile();
                Object.assign(patientProfile, profileData);
                patientProfile.user = user;
                await queryRunner.manager.save(patientProfile);
                break;
            }
            case 'clinic_admin': {
                const clinicProfile = new ClinicProfile();
                Object.assign(clinicProfile, profileData);
                clinicProfile.user = user;
                clinicProfile.status = 'pending';
                await queryRunner.manager.save(clinicProfile);
                break;
            }
            case 'doctor': {
                const doctorProfile = new Doctor();
                Object.assign(doctorProfile, profileData);
                doctorProfile.user = user;
                // Clinic is optional - doctor can join later or create private practice
                if (profileData.clinicId) {
                    const clinicRepo = queryRunner.manager.getRepository(ClinicProfile);
                    const clinic = await clinicRepo.findOneBy({ id: profileData.clinicId });
                    if (clinic) {
                        doctorProfile.clinic = clinic;
                    }
                }
                await queryRunner.manager.save(doctorProfile);
                break;
            }
            case 'pharmacy_admin': {
                const pharmacyProfile = new PharmacyProfile();
                Object.assign(pharmacyProfile, profileData);
                pharmacyProfile.user = user;
                pharmacyProfile.status = 'pending';
                await queryRunner.manager.save(pharmacyProfile);
                break;
            }
            default:
                throw new Error('Unsupported role');
        }

        await queryRunner.commitTransaction();
        res.status(201).json({ 
            message: 'User registered successfully', 
            userId: user.id,
            role: user.role
        });
    } catch (error) {
        await queryRunner.rollbackTransaction();
        logger.error('Registration error:', error);
        res.status(500).json({ message: error instanceof Error ? error.message : 'Internal server error' });
    } finally {
        await queryRunner.release();
    }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const { username, password, otp } = req.body;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { username } });
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        if (user.totpSecret) {
            if (!otp) {
                res.status(401).json({ message: 'OTP is required' });
                return;
            }
            const isValidOTP = await verifyOTP(otp, user.totpSecret);
            if (!isValidOTP) {
                res.status(401).json({ message: 'Invalid OTP' });
                return;
            }
        }
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }   
};

export const setupTOTP = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { userId } = req.params;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const secret = speakeasy.generateSecret({ length: 20 });
        user.totpSecret = secret.base32;
        await userRepository.save(user);
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
        res.status(200).json({ secret: secret.base32, qrCode: qrCodeUrl });
    } catch (error) {
        logger.error('TOTP setup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const verifyOTPForTOTP = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { userId } = req.params;
        const { token } = req.body;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user || !user.totpSecret) {
            res.status(404).json({ message: 'TOTP is not set up' });
            return;
        }
        const isValidOTP = await verifyOTP(token, user.totpSecret);
        if (!isValidOTP) {
            res.status(401).json({ message: 'Invalid OTP' });
            return;
        }
        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (error) {
        logger.error('OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const userId = (req as any).user.id;
        const { oldPassword, newPassword } = req.body;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user){
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid password' });
            return;
        }
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = newPasswordHash;
        await userRepository.save(user);
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        logger.error('Password change error : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
