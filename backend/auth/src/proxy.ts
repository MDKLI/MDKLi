import { Request, Response, NextFunction } from 'express';
import http from 'http';
import logger from './utility/logger';

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004';

export function bookingProxyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only handle /api/booking/* routes
  if (!req.path.startsWith('/api/booking')) {
    return next();
  }

  const targetUrl = BOOKING_SERVICE_URL + req.path;
  logger.info(`Proxying to booking service: ${req.method} ${req.path} -> ${targetUrl}`);

  const options = {
    hostname: 'booking-service',
    port: 3004,
    path: req.path,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'booking-service:3004',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    Object.keys(proxyRes.headers).forEach((key) => {
      const headerValue = proxyRes.headers[key];
      if (headerValue !== undefined) {
        res.setHeader(key, headerValue);
      }
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    logger.error('Proxy error:', err);
    res.status(503).json({ error: 'Booking service unavailable' });
  });

  if (req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }
  
  proxyReq.end();
}
