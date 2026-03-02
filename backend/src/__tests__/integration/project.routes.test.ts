/**
 * Teste de integrare — /api/projects/*
 * Verifică autentificarea, autorizarea RBAC și operațiunile CRUD pe proiecte.
 */

jest.mock('../../config/postgres', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../config/mongo', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
}));

// Mock complet pentru modelul mongoose Project
const mockProjectSave = jest.fn();
const mockProjectFindReturn = jest.fn();

jest.mock('../../models/Project', () => {
  function MockProject(this: any, data: any) {
    Object.assign(this, data, { _id: 'proj_mock_id_001' });
    this.save = mockProjectSave;
  }
  MockProject.find = jest.fn();
  MockProject.findById = jest.fn();
  MockProject.findByIdAndUpdate = jest.fn();
  MockProject.findByIdAndDelete = jest.fn();
  return MockProject;
});

jest.mock('../../models/Task', () => {
  function MockTask(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }
  MockTask.find = jest.fn().mockResolvedValue([]);
  MockTask.findById = jest.fn();
  MockTask.findByIdAndUpdate = jest.fn();
  MockTask.findByIdAndDelete = jest.fn();
  return MockTask;
});

import request from 'supertest';
import jwt from 'jsonwebtoken';
import pool from '../../config/postgres';
import Project from '../../models/Project';
import app from '../helpers/testApp';

const poolQuery = pool.query as jest.Mock;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

// ─── Token helpers ─────────────────────────────────────────────────────────────
function tokenFor(role: string, id = 1) {
  return jwt.sign(
    { id, email: `${role}@pms.ro`, role, firstName: role, lastName: 'User' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const adminToken = tokenFor('admin', 1);
const pmToken = tokenFor('project_manager', 2);
const memberToken = tokenFor('member', 3);
const viewerToken = tokenFor('viewer', 4);

// ─── Mock proiect ──────────────────────────────────────────────────────────────
function mockProject(overrides = {}) {
  return {
    _id: 'proj_mock_id_001',
    name: 'Proiect Test',
    description: 'Descriere',
    status: 'active',
    priority: 'medium',
    ownerId: 1,
    memberIds: [1, 2, 3],
    deadline: new Date('2025-12-31'),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/projects', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  // Helper: mongoose Project.find() chainuiește .sort() → mock chainabil
  function mockFindSort(results: any[]) {
    (Project.find as jest.Mock).mockReturnValueOnce({
      sort: jest.fn().mockResolvedValueOnce(results),
    });
  }

  it('200 — admin vede toate proiectele', async () => {
    mockFindSort([mockProject(), mockProject({ name: 'Al doilea' })]);

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(2);
  });

  it('200 — member vede doar proiectele la care este alocat', async () => {
    mockFindSort([mockProject()]);

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(Project.find).toHaveBeenCalledWith(
      expect.objectContaining({ memberIds: 3 })
    );
    expect(res.status).toBe(200);
  });

  it('200 — viewer vede proiectele la care este alocat', async () => {
    mockFindSort([]);

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(Project.find).toHaveBeenCalledWith(
      expect.objectContaining({ memberIds: 4 })
    );
    expect(res.status).toBe(200);
  });

  it('200 — filtrare după status prin query param', async () => {
    mockFindSort([mockProject({ status: 'active' })]);

    const res = await request(app)
      .get('/api/projects?status=active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(Project.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/projects', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'X', deadline: '2025-12-31' });
    expect(res.status).toBe(401);
  });

  it('403 — member nu poate crea proiecte', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Proiect', deadline: '2025-12-31' });

    expect(res.status).toBe(403);
  });

  it('403 — viewer nu poate crea proiecte', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Proiect', deadline: '2025-12-31' });

    expect(res.status).toBe(403);
  });

  it('400 — câmpuri obligatorii lipsă (admin)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fără deadline' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/deadline/);
  });

  it('201 — admin creează proiect cu succes', async () => {
    const proj = mockProject();
    mockProjectSave.mockResolvedValueOnce(proj);
    poolQuery.mockResolvedValueOnce({ rows: [] }); // audit log

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Proiect Test', deadline: '2025-12-31', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('project');
    expect(res.body.message).toMatch(/creat/);
  });

  it('201 — project_manager creează proiect cu succes', async () => {
    mockProjectSave.mockResolvedValueOnce(mockProject({ ownerId: 2 }));
    poolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Proiect PM', deadline: '2025-12-31' });

    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/projects/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 — proiect inexistent', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/projects/nonexistentid')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('200 — admin vede orice proiect', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(mockProject());

    const res = await request(app)
      .get('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Proiect Test');
  });

  it('403 — member nu vede proiectul dacă nu e alocat', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(
      mockProject({ memberIds: [1, 2] }) // member (id=3) nu e în listă
    );

    const res = await request(app)
      .get('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Nu aveți acces/);
  });

  it('200 — member vede proiectul dacă e alocat', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(
      mockProject({ memberIds: [1, 2, 3] }) // member (id=3) e în listă
    );

    const res = await request(app)
      .get('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/projects/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/projects/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('403 — member nu poate edita proiecte', async () => {
    const res = await request(app)
      .put('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Nou' });

    expect(res.status).toBe(403);
  });

  it('404 — proiect inexistent', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/projects/iddoesnotexist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nou' });

    expect(res.status).toBe(404);
  });

  it('403 — PM nu poate edita proiectele altora', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(
      mockProject({ ownerId: 1 }) // owner e admin (id=1), nu PM (id=2)
    );

    const res = await request(app)
      .put('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Edited' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permisiunea/);
  });

  it('200 — admin editează orice proiect', async () => {
    const proj = mockProject({ ownerId: 99 });
    (Project.findById as jest.Mock).mockResolvedValueOnce(proj);
    (Project.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce({ ...proj, name: 'Actualizat' });
    poolQuery.mockResolvedValueOnce({ rows: [] }); // audit

    const res = await request(app)
      .put('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Actualizat' });

    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Actualizat');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/projects/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/projects/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('403 — member nu poate șterge proiecte', async () => {
    const res = await request(app)
      .delete('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — proiect inexistent (admin)', async () => {
    (Project.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/projects/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('200 — admin șterge proiectul cu succes', async () => {
    (Project.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(mockProject());
    poolQuery.mockResolvedValueOnce({ rows: [] }); // audit

    const res = await request(app)
      .delete('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/șters/);
  });

  it('403 — PM nu poate șterge proiectele altora', async () => {
    (Project.findById as jest.Mock).mockResolvedValueOnce(
      mockProject({ ownerId: 1 }) // owner diferit de PM (id=2)
    );

    const res = await request(app)
      .delete('/api/projects/proj_mock_id_001')
      .set('Authorization', `Bearer ${pmToken}`);

    expect(res.status).toBe(403);
  });
});
