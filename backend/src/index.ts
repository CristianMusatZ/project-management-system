import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { connectPostgres } from './config/postgres';
import { connectMongo } from './config/mongo';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import notificationRoutes from './routes/notification.routes';
import settingsRoutes from './routes/settings.routes';
import labelRoutes from './routes/label.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 4000;

// ============================
// Security Middleware
// ============================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting strict pe autentificare (protecție brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 20, // max 20 încercări de login per IP
  message: { error: 'Prea multe încercări de autentificare. Încercați din nou mai târziu.' },
});

// Rate limiting general pe restul API-ului (protecție de bază)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 500, // max 500 request-uri per IP pentru navigare normală
  message: { error: 'Prea multe request-uri. Încercați din nou mai târziu.' },
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// ============================
// General Middleware
// ============================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ============================
// Routes
// ============================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'PMS Backend API',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/labels', labelRoutes);

// Servire fișiere uploadate (atașamente la sarcini)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================
// Error Handler (must be last)
// ============================
app.use(errorHandler);

// ============================
// Start Server
// ============================
async function startServer() {
  try {
    // Conectare baze de date
    await connectPostgres();
    await connectMongo();

    app.listen(PORT, () => {
      console.log(`\n🚀 PMS Backend API running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
