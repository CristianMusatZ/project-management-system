/**
 * Teste unitare — middleware/auth.ts
 * Acoperire: authenticate(), generateToken()
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, generateToken } from '../../middleware/auth';
import { AuthRequest, UserPayload } from '../../types';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const mockNext: NextFunction = jest.fn();

function makeValidToken(payload: Partial<UserPayload> = {}): string {
  const full: UserPayload = {
    id: 1, email: 'test@pms.ro', role: 'admin', firstName: 'Test', lastName: 'User',
    ...payload,
  };
  return jwt.sign(full, JWT_SECRET, { expiresIn: '1h' });
}

// ─── authenticate ────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează 401 dacă headerul Authorization lipsește', () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autentificare lipsă.' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returnează 401 dacă headerul nu începe cu "Bearer "', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autentificare lipsă.' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returnează 401 pentru token invalid (string aleator)', () => {
    const req = { headers: { authorization: 'Bearer not.a.real.token' } } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid sau expirat.' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returnează 401 pentru token expirat', () => {
    const expired = jwt.sign(
      { id: 1, email: 'x@x.ro', role: 'member', firstName: 'X', lastName: 'Y' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const req = { headers: { authorization: `Bearer ${expired}` } } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returnează 401 pentru token semnat cu alt secret', () => {
    const wrongToken = jwt.sign(
      { id: 1, email: 'x@x.ro', role: 'admin', firstName: 'X', lastName: 'Y' },
      'wrong_secret',
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${wrongToken}` } } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('apelează next() și setează req.user pentru token valid', () => {
    const token = makeValidToken({ id: 42, role: 'member', email: 'ion@pms.ro' });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe(42);
    expect(req.user!.email).toBe('ion@pms.ro');
    expect(req.user!.role).toBe('member');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('setează câmpul mfaPending dacă e prezent în token', () => {
    const token = makeValidToken({ mfaPending: true });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = mockRes();
    authenticate(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user!.mfaPending).toBe(true);
  });
});

// ─── generateToken ──────────────────────────────────────────────────────────

describe('generateToken', () => {
  const payload: UserPayload = {
    id: 5, email: 'maria@pms.ro', role: 'project_manager',
    firstName: 'Maria', lastName: 'Pop',
  };

  it('generează un token JWT valid', () => {
    const token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('tokenul poate fi verificat cu același secret', () => {
    const token = generateToken(payload);
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    expect(decoded.id).toBe(5);
    expect(decoded.email).toBe('maria@pms.ro');
    expect(decoded.role).toBe('project_manager');
  });

  it('tokenul standard expiră în ~24h', () => {
    const token = generateToken(payload);
    const decoded = jwt.decode(token) as any;
    const diffSeconds = decoded.exp - decoded.iat;
    // 24h = 86400s, toleranță ±5s
    expect(diffSeconds).toBeGreaterThanOrEqual(86395);
    expect(diffSeconds).toBeLessThanOrEqual(86405);
  });

  it('tokenul MFA (mfaPending=true) expiră în ~5 minute', () => {
    const token = generateToken({ ...payload, mfaPending: true });
    const decoded = jwt.decode(token) as any;
    const diffSeconds = decoded.exp - decoded.iat;
    // 5 min = 300s, toleranță ±5s
    expect(diffSeconds).toBeGreaterThanOrEqual(295);
    expect(diffSeconds).toBeLessThanOrEqual(305);
  });

  it('conține câmpul mfaPending în payload când e setat', () => {
    const token = generateToken({ ...payload, mfaPending: true });
    const decoded = jwt.decode(token) as any;
    expect(decoded.mfaPending).toBe(true);
  });

  it('nu conține mfaPending în token-ul standard', () => {
    const token = generateToken(payload);
    const decoded = jwt.decode(token) as any;
    expect(decoded.mfaPending).toBeUndefined();
  });
});
