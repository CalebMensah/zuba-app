import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import prisma from '../config/prisma.js';

// Validate JWT_SECRET exists
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Helper function to generate secure random code
const generateSecureCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Helper function to handle validation errors
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

// Dummy hash for timing attack prevention
const DUMMY_HASH = '$2a$10$YourDummyHashHereToPreventTimingAttacks1234567890';

export const signup = async (req, res) => {
  // Check validation errors
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, phone, firstName, lastName, password, role = 'BUYER' } = req.body;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone },
        ],
      },
    });

    if (existingUser) {
      // Generic message to prevent email enumeration
      return res.status(400).json({
        success: false,
        message: 'Unable to create account. Please check your information.',
      });
    }

    // Hash the password with higher cost factor
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate secure verification code
    const verificationCode = generateSecureCode();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Hash the verification code before storing
    const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

    // Create user with PENDING verification status
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

    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Hello ${user.firstName},</p>
          <p>Thank you for signing up! Your verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; background: #f0f0f0; padding: 10px 20px; border-radius: 5px; letter-spacing: 3px;">
              ${verificationCode}
            </span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Return success response without sensitive data
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = user;
    
    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email for verification code.',
      user: {
        id: userWithoutSensitiveData.id,
        email: userWithoutSensitiveData.email,
        firstName: userWithoutSensitiveData.firstName,
        lastName: userWithoutSensitiveData.lastName,
        role: userWithoutSensitiveData.role,
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
    // Find user with pending verification
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        verificationStatus: 'PENDING',
        verificationExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!user || !user.verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    // Check if user has too many failed verification attempts
    if (user.failedVerificationAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.',
      });
    }

    // Compare hashed verification code
    const isCodeValid = await bcrypt.compare(code, user.verificationCode);

    if (!isCodeValid) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedVerificationAttempts: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    // Update user verification status
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

    //log user verification status
    console.log(`Resend verification code requested for ${email}. User found: ${!!user}, Verification status: ${user ? user.verificationStatus : 'N/A'}`);

    if (!user) {
      // Generic message to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a new verification code has been sent.',
      });
    }

    // Check if user is rate limited (e.g., requested too recently)
    if (user.verificationExpiry && user.verificationExpiry > new Date(Date.now() + 8 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another code.',
      });
    }

    // Generate new secure verification code
    const newVerificationCode = generateSecureCode();
    const newVerificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const hashedVerificationCode = await bcrypt.hash(newVerificationCode, 10);

    // Update user with new verification code and reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: hashedVerificationCode,
        verificationExpiry: newVerificationExpiry,
        failedVerificationAttempts: 0,
      },
    });

    //log data
    console.log(`Resending verification code to ${user.email}. New code: ${newVerificationCode}`);

    // Send new verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'New Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Verification Code</h2>
          <p>Hello ${user.firstName},</p>
          <p>Your new verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; background: #f0f0f0; padding: 10px 20px; border-radius: 5px; letter-spacing: 3px;">
              ${newVerificationCode}
            </span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please secure your account immediately.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

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
    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    // Check if account is locked
    if (user && user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`,
      });
    }

    // Perform password comparison even if user doesn't exist (timing attack prevention)
    const isPasswordValid = user 
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!user || !isPasswordValid) {
      // Increment failed attempts if user exists
      if (user) {
        const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
        const updateData = {
          failedLoginAttempts: newFailedAttempts,
        };

        // Lock account after 5 failed attempts
        if (newFailedAttempts >= 5) {
          updateData.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
          updateData.failedLoginAttempts = 0; // Reset counter
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if email is verified
    if (user.verificationStatus !== 'APPROVED' || !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true,
      });
    }

    // Generate JWT tokens
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '10d', // Shorter access token expiry for better security
      }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        tokenType: 'refresh',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d', // Longer refresh token expiry
      }
    );

    // Hash the refresh token before storing
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    // Update user with refresh token and last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        refreshToken: hashedRefreshToken,
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        refreshTokenCreatedAt: new Date(),
        refreshTokenUsed: false,
        lastTokenRefreshAttempt: null,
      },
    });

    // Remove sensitive data from response
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken: token,
      refreshToken,
      user: {
        id: userWithoutSensitiveData.id,
        email: userWithoutSensitiveData.email,
        firstName: userWithoutSensitiveData.firstName,
        lastName: userWithoutSensitiveData.lastName,
        role: userWithoutSensitiveData.role,
        points: userWithoutSensitiveData.points,
        isVerified: userWithoutSensitiveData.isVerified,
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
    // If implementing token blacklisting, add token to blacklist here
    // For JWT-based auth, logout is typically handled client-side
    
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
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            viewCount: true
          },
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Remove sensitive data
    const { 
      password: _, 
      verificationCode: __, 
      verificationExpiry: ___, 
      deletionCode: ____, 
      deletionExpiry: _____,
      failedLoginAttempts: ______,
      accountLockedUntil: _______,
      ...userWithoutSensitiveData 
    } = user;

    res.status(200).json({
      success: true,
      user: userWithoutSensitiveData,
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    // Generate secure deletion confirmation code
    const deletionCode = generateSecureCode();
    const deletionExpiry = new Date(Date.now() + 15 * 60 * 1000);
    const hashedDeletionCode = await bcrypt.hash(deletionCode, 10);

    // Update user with deletion code
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionCode: hashedDeletionCode,
        deletionExpiry,
      },
    });

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Account Deletion Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Account Deletion Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>We received a request to delete your account. If this was you, please use the confirmation code below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; background: #ffebee; color: #d32f2f; padding: 10px 20px; border-radius: 5px; letter-spacing: 3px;">
              ${deletionCode}
            </span>
          </div>
          <p><strong>Warning:</strong> This action is permanent and cannot be undone. All your data will be deleted.</p>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this, please secure your account immediately.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Deletion confirmation code sent to your email',
    });

  } catch (error) {
    console.error('Request account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const confirmAccountDeletion = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { code } = req.body;
  const userId = req.user.userId;

  try {
    // Find user with valid deletion code
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletionExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!user || !user.deletionCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired confirmation code',
      });
    }

    // Compare hashed deletion code
    const isCodeValid = await bcrypt.compare(code, user.deletionCode);

    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation code',
      });
    }

    // Delete user and all related data
    await prisma.user.delete({
      where: { id: userId },
    });

    // Send goodbye email
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Account Deleted Successfully',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Account Deleted</h2>
            <p>Hello ${user.firstName},</p>
            <p>Your account has been successfully deleted. We're sorry to see you go!</p>
            <p>All your data has been permanently removed from our systems.</p>
            <p>If you change your mind, you're always welcome to create a new account.</p>
            <p>Thank you for being part of our community.</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Failed to send goodbye email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });

  } catch (error) {
    console.error('Confirm account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const cancelAccountDeletion = async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Clear deletion code and expiry
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionCode: null,
        deletionExpiry: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Account deletion request cancelled',
    });

  } catch (error) {
    console.error('Cancel account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
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

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    // Find user and verify stored refresh token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if refresh token exists and hasn't expired
    if (!user.refreshToken || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired',
      });
    }

    // Verify the stored refresh token
    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!isRefreshTokenValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Check if token was already used (token rotation security)
    if (user.refreshTokenUsed) {
      // Security: invalidate all tokens and force re-login
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

    // Generate new tokens
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '15m', // 15 minutes
      }
    );

    const newRefreshToken = jwt.sign(
      {
        userId: user.id,
        tokenType: 'refresh',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d', // 7 days
      }
    );

    // Hash the new refresh token
    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    // Update user with new refresh token and mark old one as used
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedNewRefreshToken,
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
