import express from 'express';
import cors from 'cors';
import { AppDataSource } from './data-source';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import profileRoutes from './routes/profile.routes';
import mediaRoutes from './routes/media.routes';
import invitationRoutes from './routes/invitation.routes';
import requestLogger from './middleware/logger.middleware';
import logger from './utility/logger';
import { matricsMiddleware, matricsEndpoint, testCounter } from './monitor/metrics';
import { MediaService } from './services/media.service';
import { rabbitMQService } from './services/rabbitmq.service';


const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (configure properly for production)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestLogger);

app.use(matricsMiddleware);


app.get('/health', (req, res) => {
  logger.info("/health accessed");
  res.send('Auth Microservice is running');
});


app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/invitations', invitationRoutes);

app.get('/metrics', matricsEndpoint);

// Initialize RabbitMQ
rabbitMQService.connect().catch((err) => {
  logger.error("Error during RabbitMQ initialization:", err);
});

AppDataSource.initialize()
    .then(() => {
    logger.info("Data Source has been initialized!");
    app.listen(PORT, () => {
      logger.info(`Auth Microservice is running on port ${PORT}`);
    });

  })
  .catch((err) => {
    logger.error("Error during Data Source initialization:", err);
  });



