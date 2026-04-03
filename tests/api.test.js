// =============================================
// SSP Books Backend - API Tests
// =============================================

const request = require('supertest');
const app = require('../src/server');

describe('SSP Books API', () => {
  // Health Check
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('SSP Books API is running');
    });
  });

  // 404 Handler
  describe('GET /api/nonexistent', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // Auth Routes
  describe('POST /api/auth/register', () => {
    it('should require name, email, and password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject short passwords', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@test.com', password: '123' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should require email and password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });
  });

  // Course Routes
  describe('GET /api/courses', () => {
    it('should return courses list', async () => {
      const res = await request(app).get('/api/courses');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });
  });

  describe('GET /api/courses/featured', () => {
    it('should return featured courses', async () => {
      const res = await request(app).get('/api/courses/featured');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // Category Routes
  describe('GET /api/categories', () => {
    it('should return categories list', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // Cart Routes
  describe('GET /api/cart', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.statusCode).toBe(401);
    });
  });

  // Order Routes
  describe('GET /api/orders', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.statusCode).toBe(401);
    });
  });
});
