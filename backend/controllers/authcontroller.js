import crypto from 'crypto';
import { Resend } from 'resend';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import { sendEmailNotification } from '../utils/sendEmailNotification.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

const generateSecureCode = () => crypto.randomInt(100000, 999999).toString();

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  return null;
};

const DUMMY_HASH = '$2a$10$YourDummyHashHereToPreventTimingAttacks1234567890';

export const signup = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, phone, firstName, lastName, password, role = 'BUYER' } = req.body;

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone },
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Unable to create account. Please check your information.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationCode = generateSecureCode();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        phone,
        firstName,
        lastName,
        role,
        password: hashedPassword,
        verificationStatus: 'PENDING',
        verificationCode: hashedVerificationCode,
        verificationExpiry,
        points: role === 'BUYER' ? 50 : 0,
        failedLoginAttempts: 0,
      },
    });

    await sendEmailNotification({
      to: user.email,
      toName: user.firstName,
      subject: 'Email Verification Code',
      template: 'verification_code', 
      sender: 'no_reply',
      templateData: { code: verificationCode }
    });
    const { password: _, verificationCode: __, verificationExpiry: ___, ...rest } = user;

    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email for verification code.',
      user: {
        id: rest.id,
        email: rest.email,
        firstName: rest.firstName,
        lastName: rest.lastName,
        role: rest.role,
      },
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Unable to create account. Please check your information.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const verifyEmail = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, code } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        verificationStatus: 'PENDING',
        verificationExpiry: { gte: new Date() },
      },
    });

    if (!user || !user.verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    if (user.failedVerificationAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.',
      });
    }

    const isCodeValid = await bcrypt.compare(code, user.verificationCode);

    if (!isCodeValid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedVerificationAttempts: { increment: 1 } },
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationStatus: 'APPROVED',
        isVerified: true,
        verificationCode: null,
        verificationExpiry: null,
        failedVerificationAttempts: 0,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const resendVerificationCode = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        verificationStatus: 'PENDING',
      },
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a new verification code has been sent.',
      });
    }

    if (user.verificationExpiry && user.verificationExpiry > new Date(Date.now() + 8 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another code.',
      });
    }

    const newVerificationCode = generateSecureCode();
    const newVerificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const hashedVerificationCode = await bcrypt.hash(newVerificationCode, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: hashedVerificationCode,
        verificationExpiry: newVerificationExpiry,
        failedVerificationAttempts: 0,
      },
    });

    await sendEmailNotification({
      to: user.email,
      toName: user.firstName,
      subject: 'New Email Verification Code',
      template: 'verification_code',
      sender: 'no_reply',
      templateData: { code: newVerificationCode }
    });

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a new verification code has been sent.',
    });

  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const login = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`,
      });
    }

    const isPasswordValid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!user || !isPasswordValid) {
      if (user) {
        const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
        const updateData = { failedLoginAttempts: newFailedAttempts };

        if (newFailedAttempts >= 5) {
          updateData.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          updateData.failedLoginAttempts = 0;
        }

        await prisma.user.update({ where: { id: user.id }, data: updateData });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.verificationStatus !== 'APPROVED' || !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true,
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '10d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, tokenType: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        refreshToken: hashedRefreshToken,
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        refreshTokenCreatedAt: new Date(),
        refreshTokenUsed: false,
        lastTokenRefreshAttempt: null,
      },
    });

    const { password: _, verificationCode: __, verificationExpiry: ___, ...rest } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken: token,
      refreshToken,
      user: {
        id: rest.id,
        email: rest.email,
        firstName: rest.firstName,
        lastName: rest.lastName,
        role: rest.role,
        points: rest.points,
        isVerified: rest.isVerified,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        store: {
          select: { id: true, name: true, url: true, viewCount: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const {
      password: _,
      verificationCode: __,
      verificationExpiry: ___,
      deletionCode: ____,
      deletionExpiry: _____,
      failedLoginAttempts: ______,
      accountLockedUntil: _______,
      ...rest
    } = user;

    res.status(200).json({
      success: true,
      user: rest,
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const requestAccountDeletion = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { password } = req.body;
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const deletionCode = generateSecureCode();
    const deletionExpiry = new Date(Date.now() + 15 * 60 * 1000);
    const hashedDeletionCode = await bcrypt.hash(deletionCode, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { deletionCode: hashedDeletionCode, deletionExpiry },
    });

    await sendEmailNotification({
      to: user.email,
      toName: user.firstName,
      subject: 'Account Deletion Confirmation',
      template: 'account_deletion', 
      sender: 'no_reply',
      templateData: { code: deletionCode }
    });

    res.status(200).json({
      success: true,
      message: 'Deletion confirmation code sent to your email',
    });

  } catch (error) {
    console.error('Request account deletion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const confirmAccountDeletion = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { code } = req.body;
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletionExpiry: { gte: new Date() },
      },
    });

    if (!user || !user.deletionCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired confirmation code',
      });
    }

    const isCodeValid = await bcrypt.compare(code, user.deletionCode);

    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation code',
      });
    }

    await prisma.user.delete({ where: { id: userId } });

    try {
        await sendEmailNotification({
          to: user.email,
          toName: user.firstName,
          subject: 'Account Deleted Successfully',
          template: 'account_deleted', 
          sender: 'no_reply',
          templateData: {}
        });
    } catch (emailError) {
      console.error('Failed to send goodbye email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });

  } catch (error) {
    console.error('Confirm account deletion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const cancelAccountDeletion = async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletionCode: null, deletionExpiry: null },
    });

    res.status(200).json({
      success: true,
      message: 'Account deletion request cancelled',
    });

  } catch (error) {
    console.error('Cancel account deletion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.refreshToken || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token has expired' });
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!isRefreshTokenValid) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (user.refreshTokenUsed) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: null,
          refreshTokenExpiresAt: null,
          refreshTokenCreatedAt: null,
          refreshTokenUsed: false,
          lastTokenRefreshAttempt: null,
        },
      });

      return res.status(401).json({
        success: false,
        message: 'Token has already been used. Please log in again.',
      });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, tokenType: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedNewRefreshToken,
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        refreshTokenCreatedAt: new Date(),
        refreshTokenUsed: false,
        lastTokenRefreshAttempt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    console.error('Refresh token error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Refresh token has expired' });
    }

    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};