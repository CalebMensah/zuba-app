import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';


// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import storeRoutes from './routes/store.js';
import verificationRoutes from './routes/storeverification.js';
import notificationRoutes from './routes/notifications.js';
import productRoutes from './routes/product.js';
import paymentAccountRoutes from './routes/accountDetails.js';
import orderRoutes from './routes/order.js';
import sellerDashboardRoutes from './routes/sellerdashboard.js';
import cartRoutes from './routes/cart.js';
import followRoutes from './routes/storeFollowers.js';
import productLikeRoutes from './routes/productlikes.js';
import addressRoutes from './routes/address.js';
import reviewRoutes from './routes/review.js';
import paymentRoutes from './routes/payment.js';
import disputeRoutes from './routes/disputes.js';
import chatRoutes from './routes/chat.js';
import pointsRoutes from './routes/points.js';
import deliveryRoutes from './routes/delivery.js';
import escrowRoutes from './routes/escrow.js';
import adminRoutes from './routes/admin.js';
import adminAnalyticsRoutes from './routes/admindashboard.js';
import search from './routes/search.js'
import { TokenManager } from './utils/tokenManager.js';



// Config imports
import initializeSocket from './config/socket.js';
import { authenticateToken } from './middleware/authmiddleware.js';

// Load environment variables
dotenv.config();

// Configuration constants (shared with TokenManager)
const MAX_TOKENS_PER_USER = 10
const MAX_FAILURE_COUNT = 3
const CLEANUP_REVOKED_DAYS = 30

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
const io = initializeSocket(httpServer);


// 1. Trust proxy if behind reverse proxy (Nginx, AWS ALB, etc.)
app.set('trust proxy', true);

// 2. Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"], // Allow WebSocket connections
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some CDN resources
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 3. CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.FRONTEND_URL || 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 600
}));

// Body parser with size limits (prevent large payload attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


//  Disable X-Powered-By header
app.disable('x-powered-by');

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.set('io', io);


app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});


app.post('/api/register-fcm-token-firebase', authenticateToken, async (req, res) => {
  try {
    const { 
      userId, 
      fcmToken, 
      platform,
      deviceId,
      deviceModel,
      osVersion,
      appVersion,
      expiresAt
    } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR', 
        message: 'userId is required' 
      });
    }
    if (!fcmToken) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR', 
        message: 'fcmToken is required' 
      });
    }
    if (!platform) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR', 
        message: 'platform is required (IOS, ANDROID, WEB)' 
      });
    }

    // ✅ AUTO-DETECT TOKEN TYPE based on token format
    let detectedTokenType;
    if (fcmToken.startsWith('ExponentPushToken[')) {
      detectedTokenType = 'EXPO';
    } else if (fcmToken.includes(':')) {
      // FCM tokens have format: {senderId}:APA91b...
      detectedTokenType = 'FCM';
    } else {
      detectedTokenType = 'WEB_PUSH';
    }

    console.log(`🔍 Detected token type: ${detectedTokenType} for token: ${fcmToken.substring(0, 30)}...`);

    // Register token using TokenManager
    const registeredToken = await TokenManager.register({
      userId,
      token: fcmToken,
      tokenType: detectedTokenType,
      platform,
      deviceId,
      deviceModel,
      osVersion,
      appVersion,
      expiresAt: detectedTokenType === 'EXPO' ? expiresAt : undefined
    });

    // Return the registered token data
    res.json({ 
      success: true, 
      data: {
        id: registeredToken.id,
        tokenType: registeredToken.tokenType,
        platform: registeredToken.platform,
        deviceModel: registeredToken.deviceModel,
        lastUsedAt: registeredToken.lastUsedAt,
        createdAt: registeredToken.createdAt
      },
      message: 'Token registered successfully'
    });
  } catch (error) {
    console.error(' Token registration error:', error);
    
    let statusCode = 500;
    let errorCode = 'REGISTRATION_ERROR';
    let message = error.message;

    if (error.message.includes('Expo tokens require expiresAt')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (error.code === 'P2002') {
      statusCode = 409;
      errorCode = 'DUPLICATE_ENTRY';
    } else if (error.code === 'P2003') {
      statusCode = 404;
      errorCode = 'USER_NOT_FOUND';
      message = 'User not found';
    }

    res.status(statusCode).json({ 
      success: false,
      error: errorCode, 
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

app.post('/api/unregister-fcm-token-firebase', authenticateToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR', 
        message: 'fcmToken is required' 
      });
    }

    // Revoke the specific token
    const result = await TokenManager.revoke(fcmToken);

    if (result.count === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'TOKEN_NOT_FOUND',
        message: 'Token not found or already revoked'
      });
    }

    res.json({ 
      success: true, 
      data: { revokedCount: result.count },
      message: 'Token unregistered successfully'
    });

  } catch (error) {
    console.error('Token unregistration error:', error.message);

    res.status(500).json({ 
      success: false,
      error: 'UNREGISTRATION_ERROR', 
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Optional: Revoke all tokens for a user (useful for logout)
app.post('/api/revoke-all-tokens', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR', 
        message: 'userId is required' 
      });
    }

    const result = await TokenManager.revokeAllForUser(userId);

    console.log(`Revoked ${result.count} tokens for user ${userId}`);

    res.json({ 
      success: true, 
      data: { revokedCount: result.count },
      message: 'All tokens revoked successfully'
    });

  } catch (error) {
    console.error('revoke all tokens error:', error.message);

    res.status(500).json({ 
      success: false,
      error: 'REVOKE_ERROR', 
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Admin endpoint to clean up invalid tokens
app.post('/api/admin/cleanup-tokens', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const result = await TokenManager.cleanup();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.cleaned} invalid tokens`,
      data: result
    });
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up tokens',
      error: error.message
    });
  }
});


app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payment-accounts', paymentAccountRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller-dashboard', sellerDashboardRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/store-following', followRoutes);
app.use('/api/product-likes', productLikeRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);


app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to the Express server!',
    version: '1.0.0',
    documentation: '/api/health'
  });
});


app.use((req, res) => {
  console.warn(`[404] Route not found: ${req.method} ${req.path} from IP: ${req.ip}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});


app.use((err, req, res, next) => {
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Access denied from this origin'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token expired'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors || {}).map(e => e.message)
    });
  }

  // Prisma/Database errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this data already exists'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found'
    });
  }

  // Log the full error server-side
  console.error('Global error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId
  });

  // Send generic error to client (don't leak sensitive info)
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});


const { exec } = await import('child_process');

function startServer() {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Socket.IO enabled and ready`);
    console.log(`Security middleware active`);
    console.log(`Started at: ${new Date().toISOString()}`);
  });
}

startServer();

export default app;