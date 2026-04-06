process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const jwt = require('jsonwebtoken');
const {
  authenticate,
  authorize,
  optionalAuth,
} = require('../src/middleware/auth');
const {
  errorHandler,
  notFound,
} = require('../src/middleware/errorHandler');

const makeResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return res;
};

describe('Auth middleware', () => {
  it('rejects requests without a bearer token', () => {
    const req = { headers: {} };
    const res = makeResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Access denied. No token provided.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens', () => {
    const req = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid or expired token.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user when the token is valid', () => {
    const token = jwt.sign({ id: 7, role: 'admin' }, process.env.JWT_SECRET);
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(req.user).toMatchObject({ id: 7, role: 'admin' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks users without the required role', () => {
    const req = {
      user: {
        id: 1,
        role: 'user',
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Access denied. Insufficient permissions.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows users with the required role', () => {
    const req = {
      user: {
        id: 2,
        role: 'admin',
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets req.user during optional auth when the token is valid', () => {
    const token = jwt.sign({ id: 9, role: 'user' }, process.env.JWT_SECRET);
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    optionalAuth(req, res, next);

    expect(req.user).toMatchObject({ id: 9, role: 'user' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues without a user during optional auth when the token is invalid', () => {
    const req = {
      headers: {
        authorization: 'Bearer broken-token',
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    optionalAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('Error middleware', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('maps postgres unique violations to 409', () => {
    const res = makeResponse();

    errorHandler(
      { code: '23505', detail: 'email already exists' },
      {},
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Resource already exists.',
      detail: 'email already exists',
    });
  });

  it('maps foreign key violations to 400', () => {
    const res = makeResponse();

    errorHandler(
      { code: '23503', detail: 'course missing' },
      {},
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Referenced resource not found.',
      detail: 'course missing',
    });
  });

  it('maps JWT parsing errors to 401', () => {
    const res = makeResponse();

    errorHandler(
      { name: 'JsonWebTokenError', message: 'jwt malformed' },
      {},
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid token.',
    });
  });

  it('maps expired tokens to 401', () => {
    const res = makeResponse();

    errorHandler(
      { name: 'TokenExpiredError', message: 'jwt expired' },
      {},
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token has expired.',
    });
  });

  it('maps validation errors to 400', () => {
    const res = makeResponse();

    errorHandler(
      { name: 'ValidationError', message: 'Payload is invalid' },
      {},
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Payload is invalid',
    });
  });

  it('returns the provided status code for generic errors', () => {
    const res = makeResponse();

    errorHandler(
      { statusCode: 418, message: 'Short and stout' },
      {},
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Short and stout',
    });
  });

  it('returns 404 from the notFound handler', () => {
    const req = { originalUrl: '/api/missing' };
    const res = makeResponse();

    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Route /api/missing not found',
    });
  });
});
