process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query, getClient } = require('../src/config/database');
const app = require('../src/server');

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@test.com',
  role: 'user',
};

const mockAdmin = {
  id: 2,
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin',
};

const userToken = jwt.sign(mockUser, process.env.JWT_SECRET);
const adminToken = jwt.sign(mockAdmin, process.env.JWT_SECRET);

beforeEach(() => {
  query.mockReset();
  getClient.mockReset();
});

describe('Route coverage helpers', () => {
  describe('Auth routes', () => {
    it('registers a new user successfully', async () => {
      query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [{
            id: 3,
            name: 'New User',
            email: 'new@test.com',
            role: 'user',
            created_at: '2026-04-06T00:00:00.000Z',
          }],
          rowCount: 1,
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'secret123',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.user.email).toBe('new@test.com');
      expect(res.body.data.token).toBeTruthy();
    });

    it('returns 409 when registering an existing email', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Existing User',
          email: 'test@test.com',
          password: 'secret123',
        });

      expect(res.statusCode).toBe(409);
    });

    it('returns 400 when login payload is incomplete', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });

      expect(res.statusCode).toBe(400);
    });

    it('returns 401 when the login email is unknown', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'missing@test.com',
          password: 'secret123',
        });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when the login password is wrong', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);

      query.mockResolvedValueOnce({
        rows: [{
          ...mockUser,
          password_hash: passwordHash,
          avatar_url: null,
        }],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrong-pass',
        });

      expect(res.statusCode).toBe(401);
    });

    it('logs a user in successfully', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);

      query.mockResolvedValueOnce({
        rows: [{
          ...mockUser,
          password_hash: passwordHash,
          avatar_url: null,
        }],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'secret123',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.email).toBe('test@test.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.token).toBeTruthy();
    });

    it('returns 404 when the authenticated user record no longer exists', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Course and category routes', () => {
    it('supports filtered course listing requests', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ total: '1' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            title: 'Node.js Fundamentals',
            slug: 'nodejs-fundamentals',
          }],
          rowCount: 1,
        });

      const res = await request(app).get('/api/courses')
        .query({
          category: 'programming',
          difficulty: 'beginner',
          search: 'node',
          sort: 'title',
          order: 'ASC',
          page: 2,
          limit: 5,
          featured: 'true',
          bestseller: 'true',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.pagination).toMatchObject({
        page: 2,
        limit: 5,
        total: 1,
      });
    });

    it('returns bestseller courses', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Node.js Fundamentals',
        }],
        rowCount: 1,
      });

      const res = await request(app).get('/api/courses/bestsellers');

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 404 when a course slug is missing', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app).get('/api/courses/unknown-course');

      expect(res.statusCode).toBe(404);
    });

    it('validates required fields when creating courses', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Incomplete Course',
          slug: 'incomplete-course',
        });

      expect(res.statusCode).toBe(400);
    });

    it('returns a category and its published courses', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{
            id: 5,
            name: 'Programming',
            slug: 'programming',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            title: 'Node.js Fundamentals',
            slug: 'nodejs-fundamentals',
          }],
          rowCount: 1,
        });

      const res = await request(app).get('/api/categories/programming');

      expect(res.statusCode).toBe(200);
      expect(res.body.data.slug).toBe('programming');
      expect(res.body.data.courses).toHaveLength(1);
    });

    it('returns 404 when a category slug is missing', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app).get('/api/categories/missing');

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Cart and order routes', () => {
    it('validates courseId before adding a cart item', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when adding a cart item for a missing course', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: 999 });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when the user is already enrolled', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 5 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 8 }],
          rowCount: 1,
        });

      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: 5 });

      expect(res.statusCode).toBe(400);
    });

    it('returns 409 when the course is already in the cart', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 5 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        });

      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: 5 });

      expect(res.statusCode).toBe(409);
    });

    it('clears the cart for the authenticated user', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      const res = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Cart cleared.');
    });

    it('returns 400 when checkout is attempted with an empty cart', async () => {
      const client = {
        query: jest.fn(async (sql) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') {
            return {};
          }

          if (sql.includes('FROM cart_items ci')) {
            return {
              rows: [],
              rowCount: 0,
            };
          }

          return {};
        }),
        release: jest.fn(),
      };

      getClient.mockResolvedValueOnce(client);

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(400);
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('creates an order successfully during checkout', async () => {
      const client = {
        query: jest.fn(async (sql, params) => {
          if (sql === 'BEGIN' || sql === 'COMMIT') {
            return {};
          }

          if (sql.includes('FROM cart_items ci')) {
            return {
              rows: [
                { course_id: 10, price: '50.00', discount_price: '40.00' },
                { course_id: 11, price: '30.00', discount_price: null },
              ],
              rowCount: 2,
            };
          }

          if (sql.includes('INSERT INTO orders')) {
            return {
              rows: [{
                id: 99,
                total_amount: params[1],
              }],
              rowCount: 1,
            };
          }

          return {
            rows: [],
            rowCount: 1,
          };
        }),
        release: jest.fn(),
      };

      getClient.mockResolvedValueOnce(client);

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toMatchObject({
        orderId: 99,
        itemCount: 2,
      });
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('returns the current user order history', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 22,
          total_amount: '70.00',
          items: [{ course_id: 10 }],
        }],
        rowCount: 1,
      });

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 404 when a requested order is missing', async () => {
      query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app)
        .get('/api/orders/404')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('returns a single order when it exists', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 44,
          total_amount: '70.00',
          items: [{ course_id: 10 }],
        }],
        rowCount: 1,
      });

      const res = await request(app)
        .get('/api/orders/44')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.id).toBe(44);
    });
  });
});
