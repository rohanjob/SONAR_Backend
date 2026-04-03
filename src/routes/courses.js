// =============================================
// SSP Books Backend - Course Routes
// =============================================

const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/courses
 * Get all courses with filters
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      difficulty,
      search,
      sort = 'created_at',
      order = 'DESC',
      page = 1,
      limit = 12,
      featured,
      bestseller,
    } = req.query;

    let queryText = `
      SELECT c.*, cat.name as category_name, cat.slug as category_slug
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.is_published = TRUE
    `;
    const params = [];
    let paramIndex = 1;

    if (category) {
      queryText += ` AND cat.slug = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (difficulty) {
      queryText += ` AND c.difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex} OR c.author ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (featured === 'true') {
      queryText += ' AND c.is_featured = TRUE';
    }

    if (bestseller === 'true') {
      queryText += ' AND c.is_bestseller = TRUE';
    }

    // Count total
    const countQuery = queryText.replace(
      /SELECT c\.\*, cat\.name as category_name, cat\.slug as category_slug/,
      'SELECT COUNT(*) as total'
    );
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Sorting
    const allowedSorts = ['created_at', 'price', 'rating', 'students_count', 'title'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryText += ` ORDER BY c.${sortCol} ${sortOrder}`;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/featured
 * Get featured courses
 */
router.get('/featured', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, cat.name as category_name, cat.slug as category_slug
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.is_featured = TRUE AND c.is_published = TRUE
       ORDER BY c.rating DESC
       LIMIT 8`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/bestsellers
 * Get bestseller courses
 */
router.get('/bestsellers', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, cat.name as category_name, cat.slug as category_slug
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.is_bestseller = TRUE AND c.is_published = TRUE
       ORDER BY c.students_count DESC
       LIMIT 8`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:slug
 * Get a single course by slug
 */
router.get('/:slug', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, cat.name as category_name, cat.slug as category_slug
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.slug = $1`,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    // Get reviews for the course
    const reviews = await query(
      `SELECT r.*, u.name as user_name, u.avatar_url as user_avatar
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.course_id = $1
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [result.rows[0].id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        reviews: reviews.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/courses
 * Create a new course (admin only)
 */
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const {
      title, slug, description, short_description, price,
      discount_price, thumbnail_url, author, category_id,
      difficulty, duration_hours, lessons_count, tags,
    } = req.body;

    if (!title || !slug || !description || !price || !author) {
      return res.status(400).json({
        success: false,
        message: 'Title, slug, description, price, and author are required.',
      });
    }

    const result = await query(
      `INSERT INTO courses (title, slug, description, short_description, price, discount_price,
        thumbnail_url, author, category_id, difficulty, duration_hours, lessons_count, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [title, slug, description, short_description, price, discount_price,
        thumbnail_url, author, category_id, difficulty, duration_hours, lessons_count, tags]
    );

    res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
