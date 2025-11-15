import express from 'express';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js'
import storeRoutes from './routes/store.js'
import verificationRoutes from './routes/storeverification.js'
import notificationRoutes from './routes/notifications.js'
import productRoutes from './routes/product.js'
import paymentAccountRoutes from './routes/accountDetails.js';

dotenv.config()

const app = express();
const PORT = process.env.PORT;

// Middleware to parse JSON
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes)
app.use('/api/store', storeRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/products', productRoutes)
app.use('/api/notifications',notificationRoutes)
app.use('/api/payment-accounts', paymentAccountRoutes)

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Express server!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
