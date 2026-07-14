import * as amqp from 'amqplib'
import logger from '../utility/logger'

class RabbitMQService {
  private connection: any = null
  private channel: any = null
  private readonly url: string
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 10

  constructor() {
    // Use RabbitMQ credentials from env or default to admin/admin
    const rabbitUser = process.env.RABBITMQ_USER || 'admin'
    const rabbitPass = process.env.RABBITMQ_PASS || 'admin'
    const rabbitHost = process.env.RABBITMQ_HOST || 'rabbitmq'
    const rabbitPort = process.env.RABBITMQ_PORT || '5672'
    this.url = process.env.RABBITMQ_URL || `amqp://${rabbitUser}:${rabbitPass}@${rabbitHost}:${rabbitPort}`
  }

  async connect(): Promise<void> {
    try {
      logger.info(`Connecting to RabbitMQ at ${this.url}`)
      this.connection = await amqp.connect(this.url)
      this.channel = await this.connection.createChannel()
      
      // Assert exchanges
      await this.channel.assertExchange('auth.events', 'topic', { durable: true })
      
      // Handle connection events
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect...')
        this.reconnect()
      })

      this.connection.on('error', (error: any) => {
        logger.error('RabbitMQ connection error:', error)
      })

      this.reconnectAttempts = 0
      logger.info('✅ RabbitMQ connected successfully')
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error)
      this.reconnect()
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max RabbitMQ reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    
    logger.info(`Reconnecting to RabbitMQ in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      this.connect().catch((error: any) => {
        logger.error('RabbitMQ reconnection failed:', error)
      })
    }, delay)
  }

  getChannel(): any {
    return this.channel
  }

  async publishEvent(routingKey: string, data: any): Promise<boolean> {
    if (!this.channel) {
      logger.warn('RabbitMQ channel not available, event not published')
      return false
    }

    try {
      const message = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        source: 'auth-service'
      })

      const published = this.channel.publish(
        'auth.events',
        routingKey,
        Buffer.from(message),
        { persistent: true }
      )

      if (published) {
        logger.info(`Event published: ${routingKey}`)
      } else {
        logger.warn(`Event not published (channel write buffer full): ${routingKey}`)
      }

      return published
    } catch (error) {
      logger.error(`Failed to publish event ${routingKey}:`, error)
      return false
    }
  }

  // Doctor events
  async publishDoctorCreated(doctor: any): Promise<boolean> {
    return this.publishEvent('doctor.created', doctor)
  }

  async publishDoctorUpdated(doctor: any): Promise<boolean> {
    return this.publishEvent('doctor.updated', doctor)
  }

  async publishDoctorDeleted(doctorId: string): Promise<boolean> {
    return this.publishEvent('doctor.deleted', { id: doctorId })
  }

  async publishUserCreated(data: any): Promise<boolean> {
    return this.publishEvent('user.created', data);
  }

  async publishUserUpdated(data: any): Promise<boolean> {
    return this.publishEvent('user.updated', data);
  }
  // Facility events
  async publishFacilityCreated(facility: any): Promise<boolean> {
    return this.publishEvent('facility.created', facility)
  }

  async publishFacilityUpdated(facility: any): Promise<boolean> {
    return this.publishEvent('facility.updated', facility)
  }

  async publishFacilityDeleted(facilityId: string): Promise<boolean> {
    return this.publishEvent('facility.deleted', { id: facilityId })
  }

  // Branch events
  async publishBranchCreated(branch: any): Promise<boolean> {
    return this.publishEvent('branch.created', branch)
  }

  async publishBranchUpdated(branch: any): Promise<boolean> {
    return this.publishEvent('branch.updated', branch)
  }

  async publishBranchDeleted(branchId: string): Promise<boolean> {
    return this.publishEvent('branch.deleted', { id: branchId })
  }

  // Doctor-branch assignment events (facility invitations)
  async publishDoctorBranchAssigned(data: any): Promise<boolean> {
    return this.publishEvent('doctor_branch.assigned', data)
  }

  async publishDoctorBranchRemoved(data: any): Promise<boolean> {
    return this.publishEvent('doctor_branch.removed', data)
  }

  // Invitation events
  async publishInvitationAccepted(invitation: any): Promise<boolean> {
    return this.publishEvent('invitation.accepted', invitation)
  }

  async publishInvitationRejected(invitation: any): Promise<boolean> {
    return this.publishEvent('invitation.rejected', invitation)
  }

  async publishUserBlocked(userId: string): Promise<void> {
      await this.channel.publish(
          'auth.events',
          'user.blocked',
          Buffer.from(JSON.stringify({ userId })),
          { persistent: true }
      );
      logger.debug(`Published user.blocked event for ${userId}`);
  }

  async publishUserUnblocked(userId: string): Promise<void> {
      await this.channel.publish(
          'auth.events',
          'user.unblocked',
          Buffer.from(JSON.stringify({ userId })),
          { persistent: true }
      );
      logger.debug(`Published user.unblocked event for ${userId}`);
  }

  async publishUserDeleted(userId: string): Promise<void> {
      await this.channel.publish(
          'auth.events',
          'user.deleted',
          Buffer.from(JSON.stringify({ userId })),
          { persistent: true }
      );
      logger.debug(`Published user.deleted event for ${userId}`);
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close()
      }
      if (this.connection) {
        await this.connection.close()
      }
      logger.info('RabbitMQ connection closed')
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error)
    }
  }
}

export const rabbitMQService = new RabbitMQService()
