const { query, run } = require('../models/database');

const getOrders = async (req, res) => {
  try {
    const orders = await query(`SELECT o.*, rt.number as table_number, u.name as waiter_name FROM orders o LEFT JOIN restaurant_tables rt ON rt.id=o.table_id LEFT JOIN users u ON u.id=o.waiter_id WHERE o.status NOT IN ('paid','cancelled') ORDER BY o.created_at DESC`);
    res.json(orders);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getOrderByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const orders = await query(`SELECT o.*, rt.number as table_number FROM orders o LEFT JOIN restaurant_tables rt ON rt.id=o.table_id WHERE o.table_id=? AND o.status IN ('active','sent') ORDER BY o.created_at DESC LIMIT 1`, [tableId]);
    if (!orders.length) return res.status(404).json(null);
    const items = await query(`SELECT oi.*, mi.name as item_name, mi.image_emoji FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=?`, [orders[0].id]);
    res.json({ ...orders[0], items });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const createOrder = async (req, res) => {
  try {
    const { table_id, waiter_id, items, notes, order_type='dine_in' } = req.body;
    const { lastId } = await run("INSERT INTO orders (table_id, waiter_id, notes, order_type, status) VALUES (?,?,?,?,'active')", [table_id, waiter_id, notes||null, order_type]);
    for (const item of items) {
      await run("INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes) VALUES (?,?,?,?,?)", [lastId, item.menu_item_id, item.quantity, item.unit_price, item.notes||null]);
    }
    if (table_id) await run("UPDATE restaurant_tables SET status='occupied' WHERE id=?", [table_id]);
    const order = await query("SELECT * FROM orders WHERE id=?", [lastId]);
    if (req.io) req.io.emit('order:created', order[0]);
    res.json(order[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    if (items?.length) {
      for (const item of items) {
        if (item.orderItemId) {
          await run("UPDATE order_items SET quantity=?,notes=? WHERE id=?", [item.quantity, item.notes||null, item.orderItemId]);
        } else {
          await run("INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes) VALUES (?,?,?,?,?)", [id, item.menu_item_id, item.quantity, item.unit_price, item.notes||null]);
        }
      }
    }
    await run("UPDATE orders SET updated_at=datetime('now') WHERE id=?", [id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const sendToKitchen = async (req, res) => {
  try {
    const { id } = req.params;
    await run("UPDATE orders SET status='sent', updated_at=datetime('now') WHERE id=?", [id]);
    await run("UPDATE order_items SET sent_at=datetime('now') WHERE order_id=? AND sent_at IS NULL", [id]);
    const order = await query("SELECT o.*, rt.number as table_number, u.name as waiter_name FROM orders o LEFT JOIN restaurant_tables rt ON rt.id=o.table_id LEFT JOIN users u ON u.id=o.waiter_id WHERE o.id=?", [id]);
    const items = await query("SELECT oi.*, mi.name as item_name FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=?", [id]);
    if (req.io) req.io.emit('order:sent', { ...order[0], items });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateKitchenStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, status } = req.body;
    if (item_id) {
      await run("UPDATE order_items SET kitchen_status=? WHERE id=? AND order_id=?", [status, item_id, id]);
    } else {
      await run("UPDATE order_items SET kitchen_status=? WHERE order_id=?", [status, id]);
    }
    if (req.io) req.io.emit('kitchen:updated', { order_id: id, item_id, status });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getKitchenOrders = async (req, res) => {
  try {
    const items = await query(`
      SELECT oi.id as item_id, oi.order_id, oi.menu_item_id, oi.quantity, oi.notes, oi.kitchen_status, oi.sent_at,
             mi.name as item_name, rt.number as table_number, u.name as waiter_name, o.created_at
      FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      JOIN menu_items mi ON mi.id=oi.menu_item_id
      LEFT JOIN restaurant_tables rt ON rt.id=o.table_id
      LEFT JOIN users u ON u.id=o.waiter_id
      WHERE o.status IN ('sent','active') AND oi.sent_at IS NOT NULL AND oi.kitchen_status != 'done'
      ORDER BY oi.sent_at ASC
    `);
    res.json(items);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getOrders, getOrderByTable, createOrder, updateOrder, sendToKitchen, updateKitchenStatus, getKitchenOrders };
