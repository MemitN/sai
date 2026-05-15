const { query, run } = require('../models/database');

const getTables = async (req, res) => {
  try {
    const tables = await query("SELECT * FROM restaurant_tables WHERE type='table' ORDER BY number");
    res.json(tables);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await run("UPDATE restaurant_tables SET status=? WHERE id=?", [status, id]);
    const tables = await query("SELECT * FROM restaurant_tables WHERE id=?", [id]);
    if (req.io) req.io.emit('table:updated', tables[0]);
    res.json(tables[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getTables, updateTableStatus };
