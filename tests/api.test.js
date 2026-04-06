// =============================================
// SSP Books Backend - API Tests
// =============================================

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../src/config/database');
const app = require('../src/server');

const mockCourses = [
  {
    id: 1,
    title: 'Node.js Fundamentals',
    slug: 'nodejs-fundamentals',
    price: '49.99',
    discount_price: '39.99',
    is_featured: true,
    is_published: true,
    rating: 4.5,
    students_count: 100,
    category_id: 1,
  },
];

const mockCategories = [
  {
    id: 1,
    name: 'Programming',
    slug: 'programming',
    course_count: 1,
  },
];

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
  query.mockImplementation(async (sql, params) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    // Health Check
    if (normalizedSql.includes('SELECT 1')) {
      return { rows: [{ '1': 1 }], rowCount: 1 };
    }

    // Auth - Register/Login checks
    if (normalizedSql.includes('FROM users WHERE email = $1')) {
      if (params[0] === 'new@test.com') return { rows: [], rowCount: 0 };
      if (params[0] === 'test@test.com') return { rows: [mockUser], rowCount: 1 };
    }

    if (normalizedSql.includes('FROM users WHERE id = $1')) {
      return {
        rows: [mockUser],
        rowCount: 1,
      };
    }

    // Courses
    if (normalizedSql.includes('SELECT COUNT(*) as total') && normalizedSql.includes('FROM courses c')) {
      return {
        rows: [{ total: String(mockCourses.length) }],
        rowCount: 1,
      };
    }

    if (normalizedSql.includes('FROM courses c') && normalizedSql.includes('WHERE c.is_featured = TRUE')) {
      return {
        rows: mockCourses.filter((course) => course.is_featured),
        rowCount: mockCourses.length,
      };
    }

    if (normalizedSql.includes('FROM courses c') && normalizedSql.includes('WHERE c.slug = $1')) {
      return {
        rows: [mockCourses[0]],
        rowCount: 1,
      };
    }

    if (normalizedSql.includes('FROM courses c')) {
      return {
        rows: mockCourses,
        rowCount: mockCourses.length,
      };
    }

    // Categories
    if (normalizedSql.includes('FROM categories cat')) {
      return {
        rows: mockCategories,
        rowCount: mockCategories.length,
      };
    }

    if (normalizedSql.includes('SELECT id FROM courses WHERE id = $1')) {
      return {
        rows: [{ id: params[0] }],
        rowCount: 1,
      };
    }

    if (normalizedSql.includes('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2')) {
      return {
        rows: [],
        rowCount: 0,
      };
    }

    // Reviews
    if (normalizedSql.includes('FROM reviews r')) {
      return {
        rows: [],
        rowCount: 0,
      };
    }

    // Cart
    if (normalizedSql.includes('FROM cart_items ci')) {
      return {
        rows: [],
        rowCount: 0,
      };
    }

    // Generic INSERT/UPDATE/DELETE
    if (normalizedSql.includes('INSERT INTO') || normalizedSql.includes('UPDATE') || normalizedSql.includes('DELETE')) {
      return {
        rows: [params ? { id: 1, ...params } : { id: 1 }],
        rowCount: 1,
      };
    }

    return {
      rows: [],
      rowCount: 0,
    };
  });
});

describe('SSP Books API', () => {
  // Health Check
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // Auth Routes
  describe('Auth Routes', () => {
    it('POST /api/auth/register - should fail with missing fields', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.statusCode).toBe(400);
    });

    it('POST /api/auth/register - should fail with short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'new@test.com', password: '123' });
      expect(res.statusCode).toBe(400);
    });

    it('GET /api/auth/me - should require auth', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('GET /api/auth/me - should work with token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  // Course Routes
  describe('Course Routes', () => {
    it('GET /api/courses - should return list', async () => {
      const res = await request(app).get('/api/courses');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/courses/:slug - should return course', async () => {
      const res = await request(app).get('/api/courses/nodejs-fundamentals');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.slug).toBe('nodejs-fundamentals');
    });

    it('GET /api/courses/featured - should return featured', async () => {
      const res = await request(app).get('/api/courses/featured');
      expect(res.statusCode).toBe(200);
    });

    it('POST /api/courses - should deny for non-admin', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'New Course' });
      expect(res.statusCode).toBe(403);
    });

    it('POST /api/courses - should allow for admin', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'New Course',
          slug: 'new-course',
          description: 'Desc',
          price: 50,
          author: 'Admin',
        });
      expect(res.statusCode).toBe(201);
    });
  });

  // Cart Routes
  describe('Cart Routes', () => {
    it('GET /api/cart - should return items', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
    });

    it('POST /api/cart - should add item', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: 1 });
      expect(res.statusCode).toBe(201);
    });

    it('DELETE /api/cart/:id - should remove item', async () => {
      const res = await request(app)
        .delete('/api/cart/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  // Category Routes
  describe('Category Routes', () => {
    it('GET /api/categories - should return list', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.statusCode).toBe(200);
    });
  });

  // 404 Handler
  it('should return 404 for unknown route', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.statusCode).toBe(404);
  });
});
