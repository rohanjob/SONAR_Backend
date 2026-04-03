// =============================================
// SSP Books Backend - Order Routes
// =============================================

const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/orders/checkout
 * Create order from cart items
 */
router.post('/checkout', authenticate, async (req, res, next) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get cart items
    const cartResult = await client.query(
      `SELECT ci.course_id, c.price, c.discount_price
       FROM cart_items ci
       JOIN courses c ON ci.course_id = c.id
       WHERE ci.user_id = $1`,
      [req.user.id]
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty.',
      });
    }

    // Calculate total
    const totalAmount = cartResult.rows.reduce((sum, item) => {
      const price = item.discount_price ? parseFloat(item.discount_price) : parseFloat(item.price);
      return sum + price;
    }, 0);

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total_amount, status, payment_method)
       VALUES ($1, $2, 'completed', 'demo_payment')
       RETURNING *`,
      [req.user.id, totalAmount]
    );

    const order = orderResult.rows[0];

    // Create order items
    for (const item of cartResult.rows) {
      const itemPrice = item.discount_price ? item.discount_price : item.price;
      await client.query(
        'INSERT INTO order_items (order_id, course_id, price) VALUES ($1, $2, $3)',
        [order.id, item.course_id, itemPrice]
      );

      // Create enrollment
      await client.query(
        'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, item.course_id]
      );

      // Increment students count
      await client.query(
        'UPDATE courses SET students_count = students_count + 1 WHERE id = $1',
        [item.course_id]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        orderId: order.id,
        totalAmount: order.total_amount,
        itemCount: cartResult.rows.length,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/orders
 * Get user's order history
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*, 
              json_agg(json_build_object(
                'course_id', oi.course_id,
                'price', oi.price,
                'title', c.title,
                'slug', c.slug,
                'thumbnail_url', c.thumbnail_url,
                'author', c.author
              )) as items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN courses c ON oi.course_id = c.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
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
 * GET /api/orders/:id
 * Get a specific order
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*,
              json_agg(json_build_object(
                'course_id', oi.course_id,
                'price', oi.price,
                'title', c.title,
                'slug', c.slug,
                'thumbnail_url', c.thumbnail_url,
                'author', c.author
              )) as items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN courses c ON oi.course_id = c.id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
