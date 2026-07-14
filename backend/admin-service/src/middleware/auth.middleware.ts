import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'

export interface AuthedRequest extends Request {
  user?: { userId: string; role: string }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'No token provided' })
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string }
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      res.status(403).json({ error: 'Admin access required' })
      return
    }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
