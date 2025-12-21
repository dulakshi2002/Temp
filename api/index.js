import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './config.js';
// ESM
import 'dotenv/config';


import userRoutes from './routes/user.route.js';
import authRoutes from './routes/auth.route.js';
import { errorHandler as makeError } from './utils/error.js';
import aceRoutes from "./routes/ace.route.js";


// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize the Express app
const app = express();

// CORS
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true, // allow cookies from client
  })
);

// Built-in middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use("/api/ace", aceRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ACE backend is running smoothly!',
  });
});

// Not found handler
app.use((req, res, next) => {
  const err = makeError(404, `Not Found - ${req.originalUrl}`);
  next(err);
});

// Global error handler (uses utils/error.js errorHandler)
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    message,
    statusCode,
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
