/**
 * Teste de integrare — /api/auth/*
 * Supertest + Express app de test. Postgres și serviciul de email sunt mock-uite.
 */

jest.mock('../../config/postgres', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../config/mongo', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/email.service', () => ({
  isSmtpConfigured: jest.fn().mockReturnValue(false),
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('$hashed$'),
  compare: jest.fn(),
}));

import request from 'supertest';
import pool from '../../config/postgres';
import bcrypt from 'bcryptjs';
import app from '../helpers/testApp';

const poolQuery = pool.query as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function adminDbUser() {
  return {
    id: 1, email: 'admin@pms.ro', password_hash: '$hashed$',
    role: 'admin', mfa_enabled: false, first_name: 'Admin', last_name: 'User',
    is_active: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returnează status OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 — câmpuri lipsă', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ion@pms.ro' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — parolă prea scurtă', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ion@pms.ro', password: '1234', firstName: 'Ion', lastName: 'Pop' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caractere/);
  });

  it('409 — email deja înregistrat', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // email existent

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existent@pms.ro', password: 'parola123', firstName: 'Ion', lastName: 'Pop' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/deja înregistrată/);
  });

  it('201 — înregistrare reușită (fără SMTP, primul user = admin)', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })                                              // email check
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                               // user count
      .mockResolvedValueOnce({ rows: [{ ...adminDbUser(), created_at: new Date() }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] });                                             // audit

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@pms.ro', password: 'parola123', firstName: 'Admin', lastName: 'User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('admin');
  });

  it('201 — al doilea user devine member', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 2, email: 'ion@pms.ro', first_name: 'Ion', last_name: 'Pop', role: 'member', created_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ion@pms.ro', password: 'parola123', firstName: 'Ion', lastName: 'Pop' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('member');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 — câmpuri lipsă', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ion@pms.ro' });

    expect(res.status).toBe(400);
  });

  it('401 — utilizator inexistent', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@pms.ro', password: 'parola123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Email sau parolă incorectă/);
  });

  it('401 — parolă greșită', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [adminDbUser()] });
    bcryptCompare.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pms.ro', password: 'gresite' });

    expect(res.status).toBe(401);
  });

  it('200 — login reușit, returnează token', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [adminDbUser()] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    bcryptCompare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pms.ro', password: 'parola123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'admin@pms.ro', role: 'admin' });
  });

  it('200 — admin cu MFA returnează requiresMFA + tempToken', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ ...adminDbUser(), mfa_enabled: true }] });
    bcryptCompare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pms.ro', password: 'parola123' });

    expect(res.status).toBe(200);
    expect(res.body.requiresMFA).toBe(true);
    expect(res.body.tempToken).toBeDefined();
    expect(res.body.token).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('401 — token invalid', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
  });

  it('200 — token valid, returnează profilul', async () => {
    // Generăm un token real pentru test
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';
    const token = jwt.sign(
      { id: 1, email: 'admin@pms.ro', role: 'admin', firstName: 'Admin', lastName: 'User' },
      secret,
      { expiresIn: '1h' }
    );

    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@pms.ro', first_name: 'Admin', last_name: 'User', role: 'admin', created_at: new Date() }],
    });

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@pms.ro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/auth/profile', () => {
  let token: string;

  beforeAll(() => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';
    token = jwt.sign(
      { id: 1, email: 'admin@pms.ro', role: 'admin', firstName: 'Admin', lastName: 'User' },
      secret,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => jest.clearAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).put('/api/auth/profile').send({ firstName: 'X', lastName: 'Y' });
    expect(res.status).toBe(401);
  });

  it('400 — câmpuri lipsă', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ion' });
    expect(res.status).toBe(400);
  });

  it('200 — actualizare reușită', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@pms.ro', first_name: 'Ion', last_name: 'Popescu', role: 'admin' }],
    });

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ion', lastName: 'Popescu' });

    expect(res.status).toBe(200);
    expect(res.body.user.last_name).toBe('Popescu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 — email lipsă', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('200 — răspuns identic pentru email existent sau inexistent', async () => {
    // Email inexistent
    poolQuery.mockResolvedValueOnce({ rows: [] });
    const r1 = await request(app).post('/api/auth/forgot-password').send({ email: 'nope@pms.ro' });
    expect(r1.status).toBe(200);
    expect(r1.body.message).toMatch(/Dacă adresa există/);

    // Email existent
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Ion' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const r2 = await request(app).post('/api/auth/forgot-password').send({ email: 'ion@pms.ro' });
    expect(r2.status).toBe(200);
    expect(r2.body.message).toBe(r1.body.message);
  });
});
