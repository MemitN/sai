const { query } = require('../models/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sai_lounge_secret_2024';

const login = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const users = await query("SELECT * FROM users WHERE code = ? AND active = 1", [code]);
    if (!users.length) return res.status(401).json({ error: 'Invalid code' });

    const user = users[0];
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { login };
