/**
 * testApp.ts — Express app pentru teste de integrare (fără startServer / conexiuni reale la DB).
 * Importăm rutele direct, iar dependențele (postgres, mongoose) sunt mock-uite în fiecare test.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../../routes/auth.routes';
import projectRoutes from '../../routes/project.routes';
import taskRoutes from '../../routes/task.routes';
import { errorHandler } from '../../middleware/errorHandler';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

app.use(errorHandler);

export default app;
