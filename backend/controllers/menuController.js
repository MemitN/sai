const { query, run } = require('../models/database');

const getCategories = async (req, res) => {
  try {
    const cats = await query('SELECT * FROM menu_categories ORDER BY sort_order,name');
    res.json(cats);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getMenuItems = async (req, res) => {
  try {
    const items = await query(`SELECT mi.*, mc.name as category_name, mc.icon as category_icon, mc.department FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id ORDER BY mc.sort_order, mi.name`);
    res.json(items);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const createMenuItem = async (req, res) => {
  try {
    const { category_id, name, price, happy_hour_price, description, available=1, image_url, image_emoji='🍽️', unit='serving' } = req.body;
    const { lastId } = await run('INSERT INTO menu_items (category_id, name, price, happy_hour_price, description, available, image_url, image_emoji, unit) VALUES (?,?,?,?,?,?,?,?,?)', [category_id, name, price, happy_hour_price||null, description, available, image_url||null, image_emoji, unit]);
    const items = await query('SELECT mi.*, mc.name as category_name, mc.department FROM menu_items mi JOIN menu_categories mc ON mc.id=mi.category_id WHERE mi.id=?', [lastId]);
    res.json(items[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, price, happy_hour_price, description, available, image_url, image_emoji, unit } = req.body;
    await run('UPDATE menu_items SET category_id=?, name=?, price=?, happy_hour_price=?, description=?, available=?, image_url=?, image_emoji=?, unit=? WHERE id=?', [category_id, name, price, happy_hour_price||null, description, available, image_url||null, image_emoji||'🍽️', unit||'serving', id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const deleteMenuItem = async (req, res) => {
  try {
    await run('UPDATE menu_items SET available=0 WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getCategories, getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem };
