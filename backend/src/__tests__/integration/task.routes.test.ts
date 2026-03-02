/**
 * Teste de integrare — /api/tasks/*
 * Verifică autentificarea, autorizarea RBAC și operațiunile CRUD pe sarcini.
 */

jest.mock('../../config/postgres', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../config/mongo', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
}));

const mockTaskSave = jest.fn();

jest.mock('../../models/Task', () => {
  function MockTask(this: any, data: any) {
    Object.assign(this, data, { _id: 'task_mock_id_001' });
    this.save = mockTaskSave;
  }
  MockTask.find = jest.fn();
  MockTask.findById = jest.fn();
  MockTask.findByIdAndUpdate = jest.fn();
  MockTask.findByIdAndDelete = jest.fn();
  return MockTask;
});

jest.mock('../../models/Project', () => {
  function MockProject(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn();
  }
  MockProject.find = jest.fn();
  MockProject.findById = jest.fn();
  return MockProject;
});

// Mockim createNotification (folosit în task.controller)
jest.mock('../../controllers/notification.controller', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import pool from '../../config/postgres';
import Task from '../../models/Task';
import Project from '../../models/Project';
import app from '../helpers/testApp';

const poolQuery = pool.query as jest.Mock;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

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

function mockTask(overrides = {}) {
  return {
    _id: 'task_mock_id_001',
    projectId: 'proj_001',
    title: 'Sarcină Test',
    description: 'Descriere',
    status: 'todo',
    priority: 'medium',
    assigneeId: 3,
    reporterId: 1,
    deadline: new Date('2025-12-31'),
    comments: [],
    attachments: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks/all
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/tasks/all', () => {
  beforeEach(() => jest.resetAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).get('/api/tasks/all');
    expect(res.status).toBe(401);
  });

  // getAllTasks: Project.find().select('_id') → chainabil
  // Task.find({...}).sort({...}) → chainabil
  function mockFindAllTasks(projects: any[], tasks: any[]) {
    (Project.find as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce(projects),
    });
    (Task.find as jest.Mock).mockReturnValueOnce({
      sort: jest.fn().mockResolvedValueOnce(tasks),
    });
  }

  it('200 — admin primește toate sarcinile', async () => {
    mockFindAllTasks([{ _id: 'p1' }, { _id: 'p2' }], [mockTask(), mockTask({ _id: 'task_2', title: 'Alta' })]);

    const res = await request(app)
      .get('/api/tasks/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
  });

  it('200 — member primește sarcinile din proiectele lui', async () => {
    mockFindAllTasks([{ _id: 'p1' }], [mockTask()]);

    const res = await request(app)
      .get('/api/tasks/all')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(Project.find).toHaveBeenCalledWith(
      expect.objectContaining({ memberIds: 3 })
    );
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks/project/:projectId
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/tasks/project/:projectId', () => {
  beforeEach(() => jest.resetAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).get('/api/tasks/project/p1');
    expect(res.status).toBe(401);
  });

  // getTasksByProject: Task.find(filter).sort({...}) → chainabil
  function mockFindSort(results: any[]) {
    (Task.find as jest.Mock).mockReturnValueOnce({
      sort: jest.fn().mockResolvedValueOnce(results),
    });
  }

  it('200 — returnează sarcinile proiectului', async () => {
    mockFindSort([mockTask(), mockTask({ title: 'Sarcina 2' })]);

    const res = await request(app)
      .get('/api/tasks/project/proj_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
  });

  it('200 — filtrare după status prin query param', async () => {
    mockFindSort([mockTask({ status: 'done' })]);

    const res = await request(app)
      .get('/api/tasks/project/proj_001?status=done')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(Task.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done' })
    );
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/tasks/:id', () => {
  beforeEach(() => jest.resetAllMocks());

  it('404 — sarcină inexistentă', async () => {
    (Task.findById as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/tasks/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/negăsită/);
  });

  it('200 — returnează sarcina', async () => {
    (Task.findById as jest.Mock).mockResolvedValueOnce(mockTask());

    const res = await request(app)
      .get('/api/tasks/task_mock_id_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Sarcină Test');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/tasks', () => {
  beforeEach(() => jest.resetAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).post('/api/tasks').send({ projectId: 'p1', title: 'T' });
    expect(res.status).toBe(401);
  });

  it('403 — viewer nu poate crea sarcini', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ projectId: 'p1', title: 'Sarcina' });

    expect(res.status).toBe(403);
  });

  it('403 — member nu poate crea sarcini', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ projectId: 'p1', title: 'Sarcina' });

    expect(res.status).toBe(403);
  });

  it('400 — câmpuri obligatorii lipsă', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectId: 'p1' }); // lipsă title

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/titlul/);
  });

  it('201 — admin creează sarcina cu succes', async () => {
    const task = mockTask();
    mockTaskSave.mockResolvedValueOnce(task);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectId: 'proj_001', title: 'Sarcină nouă', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('task');
    expect(res.body.message).toMatch(/creat/);
  });

  it('201 — project_manager creează sarcina', async () => {
    mockTaskSave.mockResolvedValueOnce(mockTask({ reporterId: 2 }));

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ projectId: 'proj_001', title: 'Sarcina PM' });

    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tasks/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/tasks/:id', () => {
  beforeEach(() => jest.resetAllMocks());

  it('401 — fără token', async () => {
    const res = await request(app).put('/api/tasks/task_001').send({ status: 'done' });
    expect(res.status).toBe(401);
  });

  it('403 — viewer nu poate actualiza sarcini', async () => {
    const res = await request(app)
      .put('/api/tasks/task_001')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'done' });

    expect(res.status).toBe(403);
  });

  it('404 — sarcina nu există', async () => {
    (Task.findById as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/tasks/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it('403 — member nu poate actualiza sarcinile altora', async () => {
    (Task.findById as jest.Mock).mockResolvedValueOnce(
      mockTask({ assigneeId: 1 }) // assignee e admin (id=1), nu member (id=3)
    );

    const res = await request(app)
      .put('/api/tasks/task_mock_id_001')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'done' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permisiunea/);
  });

  it('200 — member poate actualiza sarcinile asignate lui', async () => {
    const task = mockTask({ assigneeId: 3, reporterId: 1 }); // assignee e member (id=3)
    (Task.findById as jest.Mock).mockResolvedValueOnce(task);
    (Task.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce({ ...task, status: 'in_progress' });

    const res = await request(app)
      .put('/api/tasks/task_mock_id_001')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  it('200 — admin actualizează orice sarcină', async () => {
    const task = mockTask({ assigneeId: 99 });
    (Task.findById as jest.Mock).mockResolvedValueOnce(task);
    (Task.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce({ ...task, status: 'done' });

    const res = await request(app)
      .put('/api/tasks/task_mock_id_001')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'done' });

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/tasks/:id', () => {
  beforeEach(() => jest.resetAllMocks());

  it('403 — member nu poate șterge sarcini', async () => {
    const res = await request(app)
      .delete('/api/tasks/task_001')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('403 — viewer nu poate șterge sarcini', async () => {
    const res = await request(app)
      .delete('/api/tasks/task_001')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — sarcina nu există', async () => {
    (Task.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/tasks/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('200 — admin șterge sarcina cu succes', async () => {
    (Task.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(mockTask());

    const res = await request(app)
      .delete('/api/tasks/task_mock_id_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/ștearsă/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/:id/comments
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/tasks/:id/comments', () => {
  beforeEach(() => jest.resetAllMocks());

  it('403 — viewer nu poate adăuga comentarii', async () => {
    const res = await request(app)
      .post('/api/tasks/task_001/comments')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ text: 'Comentariu' });

    expect(res.status).toBe(403);
  });

  it('400 — text lipsă', async () => {
    // Controllerul returnează 400 ÎNAINTE de a apela Task.findById,
    // deci nu e necesar să mock-uim DB-ul aici.
    const res = await request(app)
      .post('/api/tasks/task_mock_id_001/comments')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatoriu/);
  });

  it('404 — sarcina nu există', async () => {
    (Task.findById as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/tasks/nonexistent/comments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Un comentariu' });

    expect(res.status).toBe(404);
  });

  it('200 — admin adaugă comentariu cu succes', async () => {
    const task = mockTask({ comments: [] });
    (Task.findById as jest.Mock).mockResolvedValueOnce(task);
    (Task.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce({
      ...task,
      comments: [{ userId: 1, text: 'Comentariu test', createdAt: new Date() }],
    });

    const res = await request(app)
      .post('/api/tasks/task_mock_id_001/comments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Comentariu test' });

    expect(res.status).toBe(200);
    expect(res.body.task.comments).toHaveLength(1);
  });
});
