import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, UserPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autentificare lipsă.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalid sau expirat.' });
  }
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(
    { ...payload } as jwt.JwtPayload,
    JWT_SECRET,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as string }
  );
}
