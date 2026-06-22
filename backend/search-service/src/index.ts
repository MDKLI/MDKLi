import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import 'reflect-metadata'

import { AppDataSource } from './data-source'
import { initializeIndexes } from './config/meilisearch'
import searchRoutes from './routes/search.routes'
import syncRoutes from './routes/sync.routes'
import { rabbitMQConsumer } from './services/rabbitmq.consumer'
import * as eventHandlers from './services/event-handlers.service'
import logger from './utils/logger'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'search-service' })
})

// Routes
app.use('/api', searchRoutes)
app.use('/api/sync', syncRoutes)

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize TypeORM
    await AppDataSource.initialize()
    logger.info('✅ Database connected successfully')

    // Initialize Meilisearch
    await initializeIndexes()
    logger.info('✅ Meilisearch initialized')

    // Initialize RabbitMQ consumer
    await rabbitMQConsumer.connect()
    logger.info('✅ RabbitMQ consumer initialized')

    // Register event handlers
    rabbitMQConsumer.on('doctor.created', eventHandlers.handleDoctorCreated)
    rabbitMQConsumer.on('doctor.updated', eventHandlers.handleDoctorUpdated)
    rabbitMQConsumer.on('doctor.deleted', eventHandlers.handleDoctorDeleted)
    rabbitMQConsumer.on('facility.created', eventHandlers.handleFacilityCreated)
    rabbitMQConsumer.on('facility.updated', eventHandlers.handleFacilityUpdated)
    rabbitMQConsumer.on('facility.deleted', eventHandlers.handleFacilityDeleted)
    rabbitMQConsumer.on('branch.created', eventHandlers.handleBranchCreated)
    rabbitMQConsumer.on('branch.updated', eventHandlers.handleBranchUpdated)
    rabbitMQConsumer.on('branch.deleted', eventHandlers.handleBranchDeleted)
    rabbitMQConsumer.on('invitation.accepted', eventHandlers.handleInvitationAccepted)
    rabbitMQConsumer.on('invitation.rejected', eventHandlers.handleInvitationRejected)
    logger.info('✅ Event handlers registered')

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Search service running on port ${PORT}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
