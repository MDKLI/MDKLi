import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Error:', err)
  
  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any
    if (prismaError.code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'This slot is already booked'
      })
      return
    }
    if (prismaError.code === 'P2025') {
      res.status(404).json({
        error: 'Not found',
        message: 'Resource not found'
      })
      return
    }
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation error',
      message: err.message
    })
    return
  }
  
  // Default error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
}
