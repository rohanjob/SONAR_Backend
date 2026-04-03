// =============================================
// SSP Books Backend - Cart Routes
// =============================================

const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/cart
 * Get current user's cart items
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ci.id as cart_item_id, ci.added_at,
              c.id as course_id, c.title, c.slug, c.price, c.discount_price,
              c.thumbnail_url, c.author, c.rating, c.duration_hours,
              cat.name as category_name
       FROM cart_items ci
       JOIN courses c ON ci.course_id = c.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE ci.user_id = $1
       ORDER BY ci.added_at DESC`,
      [req.user.id]
    );

    // Calculate totals
    const items = result.rows;
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price), 0);
    const discount = items.reduce((sum, item) => {
      if (item.discount_price) {
        return sum + (parseFloat(item.price) - parseFloat(item.discount_price));
      }
      return sum;
    }, 0);
    const total = subtotal - discount;

    res.json({
      success: true,
      data: {
        items,
        summary: {
          itemCount: items.length,
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/cart
 * Add course to cart
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required.',
      });
    }

    // Check if course exists
    const courseResult = await query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    // Check if already enrolled
    const enrollmentResult = await query(
      'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    if (enrollmentResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course.',
      });
    }

    // Add to cart
    const result = await query(
      'INSERT INTO cart_items (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING RETURNING *',
      [req.user.id, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Course is already in your cart.',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Course added to cart.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/cart/:courseId
 * Remove course from cart
 */
router.delete('/:courseId', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM cart_items WHERE user_id = $1 AND course_id = $2 RETURNING *',
      [req.user.id, req.params.courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart.',
      });
    }

    res.json({
      success: true,
      message: 'Course removed from cart.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/cart
 * Clear entire cart
 */
router.delete('/', authenticate, async (req, res, next) => {
  try {
    await query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

    res.json({
      success: true,
      message: 'Cart cleared.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
