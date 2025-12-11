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

// Config imports
import initializeSocket from './config/socket.js';
//import { generalLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

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

// 4. Body parser with size limits (prevent large payload attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// 6. Disable X-Powered-By header
app.disable('x-powered-by');

// 7. HTTP request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // In production, use a more detailed format and log to file
  app.use(morgan('combined'));
}

// 8. Make Socket.IO available to routes
app.set('io', io);

// 9. Apply general rate limiter to all API routes
//app.use('/api', generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
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
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Socket.IO enabled and ready`);
    console.log(`🔒 Security middleware active`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('========================================');
  });
}


// Handle port already in use
httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(` Port ${PORT} is already in use`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 Attempting to kill process on port ${PORT}...`);
      const command = process.platform === 'win32'
        ? `netstat -ano | findstr :${PORT}` // Windows
        : `lsof -ti :${PORT} | xargs kill -9`; // Unix/Linux/Mac
      
      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error(`❌ Error killing process on port ${PORT}:`, err.message);
          console.log('💡 Please manually kill the process or use a different port');
          process.exit(1);
        } else {
          console.log(`✅ Process(es) on port ${PORT} killed. Restarting...`);
          setTimeout(startServer, 1000); // Wait 1 second before retrying
        }
      });
    } else {
      console.error('💡 In production, use a process manager like PM2');
      process.exit(1);
    }
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  // Close server gracefully
  httpServer.close(() => {
    console.log('🛑 Server closed due to unhandled rejection');
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Close server gracefully
  httpServer.close(() => {
    console.log('🛑 Server closed due to uncaught exception');
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📡 SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

export default app;