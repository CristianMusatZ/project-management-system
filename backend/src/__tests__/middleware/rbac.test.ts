/**
 * Teste unitare — middleware/rbac.ts
 * Acoperire: authorize()
 */
import { Response, NextFunction } from 'express';
import { authorize } from '../../middleware/rbac';
import { AuthRequest, UserPayload, UserRole } from '../../types';

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReqWithUser(role: UserRole, id = 1): AuthRequest {
  const user: UserPayload = {
    id, email: `${role}@pms.ro`, role, firstName: 'Test', lastName: 'User',
  };
  return { user } as unknown as AuthRequest;
}

function mockReqNoUser(): AuthRequest {
  return {} as AuthRequest;
}

describe('authorize middleware (RBAC)', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  // ── Caz: utilizator neautentificat ─────────────────────────────────────────
  it('returnează 401 dacă req.user lipsește', () => {
    const middleware = authorize('admin');
    const req = mockReqNoUser();
    const res = mockRes();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nu sunteți autentificat.' });
    expect(next).not.toHaveBeenCalled();
  });

  // ── Caz: rol insuficient ───────────────────────────────────────────────────
  it('returnează 403 dacă utilizatorul are un rol nepermis', () => {
    const middleware = authorize('admin', 'project_manager');
    const req = mockReqWithUser('member');
    const res = mockRes();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Nu aveți permisiunea necesară pentru această acțiune.',
        requiredRoles: ['admin', 'project_manager'],
        yourRole: 'member',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returnează 403 pentru viewer când se cere admin', () => {
    const middleware = authorize('admin');
    const req = mockReqWithUser('viewer');
    const res = mockRes();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Caz: rol permis ────────────────────────────────────────────────────────
  it('apelează next() dacă utilizatorul are rolul exact cerut', () => {
    const middleware = authorize('admin');
    const req = mockReqWithUser('admin');
    const res = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('apelează next() dacă rolul utilizatorului se află printre cele permise', () => {
    const middleware = authorize('admin', 'project_manager', 'member');
    const req = mockReqWithUser('project_manager');
    const res = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('apelează next() pentru fiecare rol permis din lista completă', () => {
    const roles: UserRole[] = ['admin', 'project_manager', 'member', 'viewer'];
    const middleware = authorize(...roles);

    for (const role of roles) {
      const req = mockReqWithUser(role);
      const res = mockRes();
      const n = jest.fn();
      middleware(req, res, n);
      expect(n).toHaveBeenCalledTimes(1);
    }
  });

  // ── Caz: returnează middleware diferit la fiecare apel ──────────────────────
  it('returnează o funcție middleware distinctă la fiecare apel', () => {
    const m1 = authorize('admin');
    const m2 = authorize('member');
    expect(m1).not.toBe(m2);
  });

  // ── Caz: authorize fără roluri (edge case) ─────────────────────────────────
  it('refuză orice utilizator dacă lista de roluri e goală', () => {
    const middleware = authorize();
    const req = mockReqWithUser('admin');
    const res = mockRes();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
