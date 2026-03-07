/**
 * Teste unitare — controllers/auth.controller.ts
 * Toate dependențele externe (postgres pool, bcrypt, email) sunt mock-uite.
 */

// ─── Mock-uri (trebuie declarate ÎNAINTE de import-uri, jest le hoistează) ───
jest.mock('../../config/postgres', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../services/email.service', () => ({
  isSmtpConfigured: jest.fn().mockReturnValue(false),
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('mockedSalt'),
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn(),
}));

// ─── Import-uri ───────────────────────────────────────────────────────────────
import { Request, Response } from 'express';
import pool from '../../config/postgres';
import bcrypt from 'bcryptjs';
import { isSmtpConfigured } from '../../services/email.service';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../../controllers/auth.controller';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const poolQuery = pool.query as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(body: Record<string, unknown> = {}, extra: Partial<Request> = {}): Request {
  return { body, ip: '127.0.0.1', headers: {}, query: {}, params: {}, ...extra } as unknown as Request;
}

// ─────────────────────────────────────────────────────────────────────────────
// register
// ─────────────────────────────────────────────────────────────────────────────
describe('register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isSmtpConfigured as jest.Mock).mockReturnValue(false);
  });

  it('returnează 400 dacă lipsesc câmpuri obligatorii', async () => {
    const req = makeReq({ email: 'ion@pms.ro' });
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Toate câmpurile sunt obligatorii.' });
  });

  it('returnează 400 dacă parola are mai puțin de 8 caractere', async () => {
    const req = makeReq({ email: 'ion@pms.ro', password: '1234567', firstName: 'Ion', lastName: 'Pop' });
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
  });

  it('returnează 409 dacă emailul este deja înregistrat', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // email existent
    const req = makeReq({ email: 'existent@pms.ro', password: 'parola123', firstName: 'Ion', lastName: 'Pop' });
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Adresa de email este deja înregistrată.' });
  });

  it('înregistrează cu succes primul utilizator ca admin (fără SMTP)', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })                           // email check: nu există
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })            // user count: 0 → primul user
      .mockResolvedValueOnce({                                        // INSERT user
        rows: [{ id: 1, email: 'admin@pms.ro', first_name: 'Admin', last_name: 'User', role: 'admin', created_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] });                          // audit log

    const req = makeReq({ email: 'admin@pms.ro', password: 'parola123', firstName: 'Admin', lastName: 'User' });
    const res = mockRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg).toHaveProperty('token');
    expect(jsonArg.user.role).toBe('admin');
  });

  it('înregistrează al doilea utilizator ca member', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })            // user count: 1 → nu primul
      .mockResolvedValueOnce({
        rows: [{ id: 2, email: 'ion@pms.ro', first_name: 'Ion', last_name: 'Pop', role: 'member', created_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = makeReq({ email: 'ion@pms.ro', password: 'parola123', firstName: 'Ion', lastName: 'Pop' });
    const res = mockRes();
    await register(req, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.user.role).toBe('member');
  });

  it('returnează requiresEmailVerification când SMTP e configurat', async () => {
    (isSmtpConfigured as jest.Mock).mockReturnValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 3, email: 'nou@pms.ro', first_name: 'Nou', last_name: 'User', role: 'member', created_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = makeReq({ email: 'nou@pms.ro', password: 'parola123', firstName: 'Nou', lastName: 'User' });
    const res = mockRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.requiresEmailVerification).toBe(true);
    expect(jsonArg.token).toBeUndefined();
  });

  it('returnează 500 la eroare de DB', async () => {
    poolQuery.mockRejectedValueOnce(new Error('DB connection error'));
    const req = makeReq({ email: 'x@pms.ro', password: 'parola123', firstName: 'X', lastName: 'Y' });
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// login
// ─────────────────────────────────────────────────────────────────────────────
describe('login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează 400 dacă lipsesc email sau parola', async () => {
    const req = makeReq({ email: 'x@pms.ro' });
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email și parola sunt obligatorii.' });
  });

  it('returnează 401 dacă utilizatorul nu există', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] }); // nu găsit
    const req = makeReq({ email: 'ghost@pms.ro', password: 'parola123' });
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email sau parolă incorectă.' });
  });

  it('returnează 401 dacă parola nu se potrivește', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ion@pms.ro', password_hash: 'hashed', role: 'member', mfa_enabled: false, first_name: 'Ion', last_name: 'Pop' }],
    });
    bcryptCompare.mockResolvedValueOnce(false);

    const req = makeReq({ email: 'ion@pms.ro', password: 'parolaGresita' });
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email sau parolă incorectă.' });
  });

  it('returnează token JWT la autentificare reușită (fără MFA)', async () => {
    poolQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'ion@pms.ro', password_hash: 'hashed', role: 'member', mfa_enabled: false, first_name: 'Ion', last_name: 'Pop' }],
      })
      .mockResolvedValueOnce({ rows: [] }); // audit log
    bcryptCompare.mockResolvedValueOnce(true);

    const req = makeReq({ email: 'ion@pms.ro', password: 'parola123' });
    const res = mockRes();
    await login(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg).toHaveProperty('token');
    expect(jsonArg.user.email).toBe('ion@pms.ro');
  });

  it('returnează requiresMFA pentru admin cu MFA activat', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@pms.ro', password_hash: 'hashed', role: 'admin', mfa_enabled: true, first_name: 'Admin', last_name: 'User' }],
    });
    bcryptCompare.mockResolvedValueOnce(true);

    const req = makeReq({ email: 'admin@pms.ro', password: 'parola123' });
    const res = mockRes();
    await login(req, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.requiresMFA).toBe(true);
    expect(jsonArg.tempToken).toBeDefined();
    expect(jsonArg.token).toBeUndefined();
  });

  it('returnează 500 la eroare de DB', async () => {
    poolQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ email: 'x@pms.ro', password: 'parola123' });
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getProfile
// ─────────────────────────────────────────────────────────────────────────────
describe('getProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează profilul utilizatorului autentificat', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ion@pms.ro', first_name: 'Ion', last_name: 'Pop', role: 'member', created_at: new Date() }],
    });
    const req = { ...makeReq(), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await getProfile(req, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.user.email).toBe('ion@pms.ro');
  });

  it('returnează 404 dacă utilizatorul nu există în DB', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });
    const req = { ...makeReq(), user: { id: 999 } } as unknown as Request;
    const res = mockRes();
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProfile
// ─────────────────────────────────────────────────────────────────────────────
describe('updateProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează 400 dacă lipsesc firstName sau lastName', async () => {
    const req = { ...makeReq({ firstName: 'Ion' }), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('actualizează profilul cu succes', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ion@pms.ro', first_name: 'Ion', last_name: 'Popescu', role: 'member' }],
    });
    const req = { ...makeReq({ firstName: 'Ion', lastName: 'Popescu' }), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await updateProfile(req, res);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.user.last_name).toBe('Popescu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changePassword
// ─────────────────────────────────────────────────────────────────────────────
describe('changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează 400 dacă lipsesc parolele', async () => {
    const req = { ...makeReq({ currentPassword: 'veche' }), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await changePassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returnează 400 dacă parola nouă este prea scurtă', async () => {
    const req = { ...makeReq({ currentPassword: 'parola123', newPassword: '1234' }), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await changePassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Parola nouă trebuie să aibă cel puțin 8 caractere.' });
  });

  it('returnează 401 dacă parola curentă este incorectă', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'hashedOld' }] });
    bcryptCompare.mockResolvedValueOnce(false);

    const req = { ...makeReq({ currentPassword: 'gresite', newPassword: 'parolaNoua123' }), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await changePassword(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Parola curentă este incorectă.' });
  });

  it('schimbă parola cu succes', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: 'hashedOld' }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE
    bcryptCompare.mockResolvedValueOnce(true);

    const req = { ...makeReq({ currentPassword: 'parola123', newPassword: 'parolaNoua123' }), user: { id: 1 } } as unknown as Request;
    const res = mockRes();
    await changePassword(req, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.message).toBe('Parola a fost schimbată cu succes.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// forgotPassword
// ─────────────────────────────────────────────────────────────────────────────
describe('forgotPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează 400 dacă emailul lipsește', async () => {
    const req = makeReq({});
    const res = mockRes();
    await forgotPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returnează același mesaj indiferent dacă emailul există sau nu (anti-enumerare)', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] }); // email inexistent
    const req = makeReq({ email: 'fantasma@pms.ro' });
    const res = mockRes();
    await forgotPassword(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.message).toBe('Dacă adresa există, vei primi instrucțiuni de resetare.');
  });

  it('creează token de resetare și returnează resetUrl în development', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Ion' }] })  // user găsit
      .mockResolvedValueOnce({ rows: [] })                                // invalidare tokeni vechi
      .mockResolvedValueOnce({ rows: [] });                               // inserare token nou

    const req = makeReq({ email: 'ion@pms.ro' });
    const res = mockRes();
    await forgotPassword(req, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.message).toBe('Dacă adresa există, vei primi instrucțiuni de resetare.');
    // în development returnăm resetUrl pentru testare
    expect(jsonArg.resetUrl).toMatch(/reset-password\?token=/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetPassword
// ─────────────────────────────────────────────────────────────────────────────
describe('resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returnează 400 dacă lipsesc token sau newPassword', async () => {
    const req = makeReq({ token: 'abc' });
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returnează 400 dacă parola nouă e prea scurtă', async () => {
    const req = makeReq({ token: 'abc123', newPassword: 'scurt' });
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
  });

  it('returnează 400 dacă token-ul e invalid sau expirat', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] }); // token invalid
    const req = makeReq({ token: 'tokenInvalid', newPassword: 'parolaNoua123' });
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token invalid sau expirat. Solicită un nou link de resetare.',
    });
  });

  it('resetează parola cu succes', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 5, email: 'ion@pms.ro' }] }) // token valid
      .mockResolvedValueOnce({ rows: [] })                                              // UPDATE password
      .mockResolvedValueOnce({ rows: [] })                                              // marcare token used
      .mockResolvedValueOnce({ rows: [] });                                             // audit log

    const req = makeReq({ token: 'validtoken', newPassword: 'parolaNoua123' });
    const res = mockRes();
    await resetPassword(req, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.message).toBe('Parola a fost resetată cu succes. Te poți autentifica acum.');
  });
});
