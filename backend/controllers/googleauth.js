import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

// Initialize Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Validate JWT_SECRET exists
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

export const googleAuth = async (req, res) => {
  const { idToken, email, firstName, lastName, photoURL, uid } = req.body;

  try {
    // Verify the Google ID token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
      });
    }

    const payload = ticket.getPayload();
    
    // Verify email matches
    if (payload.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email mismatch',
      });
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            viewCount: true,
          },
        },
      },
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          firstName: firstName || 'User',
          lastName: lastName || '',
          role: 'BUYER', // Default role
          googleId: uid,
          photoURL: photoURL || null,
          isVerified: true, // Google accounts are pre-verified
          verificationStatus: 'APPROVED',
          points: 50, // Welcome bonus for new users
          failedLoginAttempts: 0,
          // No password needed for Google auth
          password: '', // Empty password - Google users can't use email/password login
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              url: true,
              viewCount: true,
            },
          },
        },
      });

      console.log('New user created via Google auth:', user.email);
    } else {
      // Update existing user with Google info if not already set
      const updateData = {};
      
      if (!user.googleId) {
        updateData.googleId = uid;
      }
      
      if (!user.photoURL && photoURL) {
        updateData.photoURL = photoURL;
      }

      // If user exists but wasn't verified, mark as verified
      if (!user.isVerified) {
        updateData.isVerified = true;
        updateData.verificationStatus = 'APPROVED';
      }

      // Update last login
      updateData.lastLogin = new Date();
      updateData.failedLoginAttempts = 0;
      updateData.accountLockedUntil = null;

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: {
            store: {
              select: {
                id: true,
                name: true,
                url: true,
                viewCount: true,
              },
            },
          },
        });
      }

      console.log('Existing user logged in via Google:', user.email);
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
        expiresIn: '24h',
      }
    );

    // Remove sensitive data from response
    const {
      password: _,
      verificationCode: __,
      verificationExpiry: ___,
      deletionCode: ____,
      deletionExpiry: _____,
      failedLoginAttempts: ______,
      accountLockedUntil: _______,
      googleId: ________,
      ...userWithoutSensitiveData
    } = user;

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      isNewUser,
      token,
      user: {
        id: userWithoutSensitiveData.id,
        email: userWithoutSensitiveData.email,
        firstName: userWithoutSensitiveData.firstName,
        lastName: userWithoutSensitiveData.lastName,
        role: userWithoutSensitiveData.role,
        points: userWithoutSensitiveData.points,
        isVerified: userWithoutSensitiveData.isVerified,
        photoURL: userWithoutSensitiveData.photoURL,
        store: userWithoutSensitiveData.store,
      },
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};