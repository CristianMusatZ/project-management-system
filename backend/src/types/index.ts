import { Request } from 'express';

export type UserRole = 'admin' | 'project_manager' | 'member' | 'viewer';

export interface UserPayload {
  id: number;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** Prezent doar în token-ul temporar MFA (înainte de verificarea codului OTP) */
  mfaPending?: boolean;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
