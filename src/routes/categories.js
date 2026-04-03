// =============================================
// SSP Books Backend - Category Routes
// =============================================

const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

/**
 * GET /api/categories
 * Get all categories with course count
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cat.*, COUNT(c.id)::int as course_count
       FROM categories cat
       LEFT JOIN courses c ON cat.id = c.category_id AND c.is_published = TRUE
       GROUP BY cat.id
       ORDER BY cat.name ASC`
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
 * GET /api/categories/:slug
 * Get a single category with its courses
 */
router.get('/:slug', async (req, res, next) => {
  try {
    const catResult = await query(
      'SELECT * FROM categories WHERE slug = $1',
      [req.params.slug]
    );

    if (catResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const category = catResult.rows[0];

    const coursesResult = await query(
      `SELECT c.*, cat.name as category_name, cat.slug as category_slug
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.category_id = $1 AND c.is_published = TRUE
       ORDER BY c.rating DESC`,
      [category.id]
    );

    res.json({
      success: true,
      data: {
        ...category,
        courses: coursesResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
