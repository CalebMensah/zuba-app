import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD, // Use app password for Gmail
  },
});

export const signup = async (req, res) => {
  const { email, phone, firstName, lastName, password, role = 'BUYER' } = req.body;

  try {
    // Validate required fields
    if (!email || !phone || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }


    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Validate phone number (adjust regex as needed for your region)
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
      });
    }

    // Validate role
    const validRoles = ['BUYER', 'SELLER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be BUYER, SELLER, or ADMIN',
      });
    }

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
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone already exists',
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

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
        verificationCode,
        verificationExpiry,
        points: role === 'BUYER' ? 50 : 0, // Award 50 points to buyers
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
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    if (error.code === 'P2002') {
      // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required',
      });
    }

    // Find user with pending verification
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        verificationStatus: 'PENDING',
        verificationExpiry: {
          gte: new Date(), // Not expired
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    if (user.verificationCode !== code) {
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        verificationStatus: 'PENDING',
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already verified',
      });
    }

    // Generate new verification code
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update user with new verification code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: newVerificationCode,
        verificationExpiry: newVerificationExpiry,
      },
    });

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
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'New verification code sent successfully',
    });

  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user) {
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

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d', // Token expires in 7 days
      }
    );

    // Update last login timestamp (optional)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
      },
    });

    // Remove sensitive data from response
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Optional: Logout endpoint (for token blacklisting if needed)
export const logout = async (req, res) => {
  try {
    // If you're using token blacklisting, add the token to blacklist here
    // For now, we'll just send a success response
    // Client should remove the token from storage

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Optional: Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    // Assuming you have authentication middleware that adds user to req
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Remove sensitive data
    const { password: _, verificationCode: __, verificationExpiry: ___, ...userWithoutSensitiveData } = user;

    res.status(200).json({
      success: true,
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Request account deletion (with password confirmation)
export const requestAccountDeletion = async (req, res) => {
  const { password } = req.body;
  const userId = req.user.userId; // From authentication middleware

  try {
    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account',
      });
    }

    // Get user from database
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

    // Generate deletion confirmation code
    const deletionCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deletionExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user with deletion code
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionCode,
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
          <p>If you didn't request this, please secure your account immediately and ignore this email.</p>
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Confirm and delete account
export const confirmAccountDeletion = async (req, res) => {
  const { code } = req.body;
  const userId = req.user.userId;

  try {
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation code is required',
      });
    }

    // Find user with valid deletion code
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletionCode: code,
        deletionExpiry: {
          gte: new Date(), // Not expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired confirmation code',
      });
    }

    // Delete user and all related data (cascade delete based on your Prisma schema)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Send goodbye email (optional)
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
      // Don't fail the deletion if email fails
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Cancel account deletion request
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};