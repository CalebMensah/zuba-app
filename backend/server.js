import express from 'express';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js'
import storeRoutes from './routes/store.js'
import verificationRoutes from './routes/storeverification.js'
import notificationRoutes from './routes/notifications.js'
import productRoutes from './routes/product.js'
import paymentAccountRoutes from './routes/accountDetails.js';
import orderRoutes from './routes/order.js'
import sellerDashboardRoutes from './routes/sellerdashboard.js'
import cartRoutes from './routes/cart.js'
import followRoutes from './routes/storeFollowers.js'
import productLikeRoutes from './routes/productlikes.js'
import addressRoutes from './routes/address.js'
import reviewRoutes from './routes/review.js'
import paymentRoutes from './routes/payment.js'
import disputeRoutes from './routes/disputes.js'
import chatRoutes from './routes/chat.js';
import pointsRoutes from './routes/points.js'
import deliveryRoutes from './routes/delivery.js';
import escrowRoutes from './routes/escrow.js'
import adminRoutes from './routes/admin.js';
import adminAnalyticsRoutes from './routes/admindashboard.js';


import initializeSocket from './config/socket.js';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT;

const io = initializeSocket(httpServer);

// Middleware to parse JSON
app.use(express.json());
app.set('io', io);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes)
app.use('/api/stores', storeRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/products', productRoutes)
app.use('/api/notifications',notificationRoutes)
app.use('/api/payment-accounts', paymentAccountRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/seller-dashboard',sellerDashboardRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/store-following', followRoutes)
app.use('/api/product-likes', productLikeRoutes)
app.use('/api/addresses', addressRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/payments',paymentRoutes)
app.use('/api/disputes',disputeRoutes)
app.use('/api/points', pointsRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/payments', paymentRoutes);
app.use('/api/delivery', deliveryRoutes)
app.use('/api/escrow', escrowRoutes);
app.use('/api/admin',adminRoutes)
app.use('/api/admin/analytics', adminAnalyticsRoutes);


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Express server!' });
});

const { exec } = await import('child_process');

function startServer() {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO enabled and ready`);
  });
}

// Error handling for address in use
httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Attempting to kill process on this port...`);
    // Kill process on the port using lsof and kill
    const command = `lsof -ti :${PORT} | xargs kill -9`;
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error killing process on port ${PORT}:`, err);
        process.exit(1);
      } else {
        console.log(`Process(es) on port ${PORT} killed successfully. Restarting server...`);
        // Retry listening once after killing the process
        startServer();
      }
    });
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

// Start the server initially
startServer();


process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  httpServer.close(() => process.exit(1));
});

export default app;
