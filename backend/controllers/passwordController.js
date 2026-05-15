// controllers/passwordController.js
// Handles password reset for admin & management users via email token
// Also supports admin directly resetting any user's PIN

const { query, run } = require('../models/database');
const crypto = require('crypto');
const { sendReport } = require('../services/emailService');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Step 1: Request reset link (sends email) ──
const requestReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const users = await query(
      "SELECT id, name, email, role FROM users WHERE email = ? AND role IN ('admin', 'management') AND active = 1",
      [email]
    );

    // Always return success to avoid email enumeration
    if (!users.length) {
      return res.json({ success: true, message: 'If an account with this email exists, reset instructions have been sent.' });
    }

    const user = users[0];
    await run('DELETE FROM password_resets WHERE user_id = ?', [user.id]);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    await run(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Password Reset – Sai Lounge</title></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:white;border-radius:10px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="text-align:center;border-bottom:2px solid #F59E0B;padding-bottom:20px;margin-bottom:20px;">
      <div style="font-size:24px;font-weight:bold;">Sai <span style="color:#F59E0B;">Lounge</span></div>
      <p style="color:#666;margin:4px 0 0">POS Management System</p>
    </div>
    <h2 style="margin-top:0;">Password Reset Request</h2>
    <p>Hello <strong>${user.name}</strong>,</p>
    <p>We received a request to reset your <strong>${user.role}</strong> account password. Click the button below to set a new PIN:</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${resetLink}" style="background:#F59E0B;color:#1C1917;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Reset My Password</a>
    </div>
    <p style="font-size:13px;color:#555;">Or copy this link into your browser:</p>
    <p style="background:#f5f5f5;padding:10px;border-radius:4px;word-break:break-all;font-size:12px;">${resetLink}</p>
    <p style="font-size:12px;color:#999;margin-top:20px;">⏰ This link expires in <strong>1 hour</strong>. If you did not request this, please ignore this email — your account is safe.</p>
    <hr style="margin:20px 0;">
    <p style="font-size:11px;color:#aaa;text-align:center;">Sai Lounge POS System</p>
  </div>
</body>
</html>`;

    await sendReport(user.email, 'Password Reset – Sai Lounge POS', emailHtml);
    res.json({ success: true, message: 'Password reset link sent to your email address.' });
  } catch (err) {
    console.error('Reset request error:', err);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
};

// ── Step 2: Verify token (called when user opens the link) ──
const verifyToken = async (req, res) => {
  try {
    const { token } = req.params;
    const reset = await query(
      "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
      [token]
    );
    if (!reset.length) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    const user = await query('SELECT id, name, email, role FROM users WHERE id = ?', [reset[0].user_id]);
    res.json({ valid: true, user: user[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Step 3: Set new password using token ──
const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
    }

    const reset = await query(
      "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
      [token]
    );
    if (!reset.length) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

    await run('UPDATE users SET code = ? WHERE id = ?', [new_password, reset[0].user_id]);
    await run('UPDATE password_resets SET used = 1 WHERE id = ?', [reset[0].id]);

    res.json({ success: true, message: 'Password reset successfully! You can now log in with your new PIN.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Reset any user's PIN directly (no email required) ──
// Used by admin/management from the Users page
const adminResetPassword = async (req, res) => {
  try {
    const { user_id, new_password } = req.body;
    const requestor = req.user;

    if (!requestor || !['admin', 'management'].includes(requestor.role)) {
      return res.status(403).json({ error: 'Only admin or management can reset user PINs.' });
    }
    if (!user_id || !new_password || new_password.length < 4) {
      return res.status(400).json({ error: 'User ID and a PIN of at least 4 digits are required.' });
    }

    const targetUsers = await query('SELECT id, name, role FROM users WHERE id = ?', [user_id]);
    if (!targetUsers.length) return res.status(404).json({ error: 'User not found.' });
    const target = targetUsers[0];

    // Management can only reset non-admin users; admin can reset anyone
    if (requestor.role === 'management' && target.role === 'admin') {
      return res.status(403).json({ error: 'Management cannot reset an admin password.' });
    }

    await run('UPDATE users SET code = ? WHERE id = ?', [new_password, user_id]);
    res.json({ success: true, message: `PIN for ${target.name} has been reset successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Update own email address ──
const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    await run('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
    res.json({ success: true, message: 'Email address updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { requestReset, verifyToken, resetPassword, adminResetPassword, updateEmail };
