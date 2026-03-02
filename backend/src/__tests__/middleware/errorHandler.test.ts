/**
 * Teste unitare — middleware/errorHandler.ts
 * Acoperire: errorHandler()
 */
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';

function mockReq(): Request {
  return {} as Request;
}

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const mockNext: NextFunction = jest.fn();

describe('errorHandler middleware', () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => consoleSpy.mockRestore());
  beforeEach(() => jest.clearAllMocks());

  it('returnează 400 pentru ValidationError', () => {
    const err = new Error('Câmp invalid.');
    err.name = 'ValidationError';
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Câmp invalid.' });
  });

  it('returnează 401 pentru UnauthorizedError', () => {
    const err = new Error('Forbidden');
    err.name = 'UnauthorizedError';
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nu sunteți autorizat.' });
  });

  it('returnează 500 cu mesajul erorii în development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Ceva a mers prost.');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ceva a mers prost.' });

    process.env.NODE_ENV = originalEnv;
  });

  it('returnează 500 cu mesaj generic în production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Detalii interne sensibile.');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Eroare internă de server.' });

    process.env.NODE_ENV = originalEnv;
  });

  it('loghează eroarea în consolă', () => {
    const err = new Error('Test log error');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(consoleSpy).toHaveBeenCalledWith('❌ Error:', 'Test log error');
  });
});
