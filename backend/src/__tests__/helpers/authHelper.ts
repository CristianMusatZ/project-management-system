import jwt from 'jsonwebtoken';
import { UserPayload, UserRole } from '../../types';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

/**
 * Generează un JWT valid pentru teste, fără a bate la DB.
 */
export function createTestToken(overrides: Partial<UserPayload> = {}): string {
  const payload: UserPayload = {
    id: 1,
    email: 'test@pms.ro',
    role: 'admin',
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function createTokenForRole(role: UserRole, id = 1): string {
  return createTestToken({ id, role, email: `${role}@pms.ro`, firstName: role, lastName: 'User' });
}

export function createExpiredToken(): string {
  const payload: UserPayload = { id: 1, email: 'x@x.ro', role: 'member', firstName: 'X', lastName: 'Y' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });
}
