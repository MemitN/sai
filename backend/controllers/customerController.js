// controllers/customerController.js — Sai Lounge POS
const { query, run, runTransaction } = require('../models/database');
const path = require('path');
const fs   = require('fs');

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════

const getCustomers = async (req, res) => {
  try {
    const { search, tier } = req.query;
    let conditions = ['c.active = 1'];
    const params = [];

    if (tier) { conditions.push('c.tier = ?'); params.push(tier); }
    if (search) {
      conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const customers = await query(`
      SELECT c.*,
             (SELECT MAX(b.paid_at) FROM bills b WHERE b.customer_id=c.id AND b.status='paid') AS last_visit,
             (SELECT COUNT(*) FROM loyalty_transactions lt WHERE lt.customer_id=c.id AND lt.type='earn') AS earn_count
        FROM customers c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.loyalty_points DESC, c.name ASC
    `, params);

    const summary = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(loyalty_points) AS total_points,
        SUM(total_spend)    AS total_spend,
        COUNT(CASE WHEN tier='silver'   THEN 1 END) AS silver,
        COUNT(CASE WHEN tier='gold'     THEN 1 END) AS gold,
        COUNT(CASE WHEN tier='platinum' THEN 1 END) AS platinum
      FROM customers WHERE active=1
    `);

    res.json({ customers, summary: summary[0] || {} });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const lookupCustomer = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const [customer] = await query(`
      SELECT c.*,
        (SELECT MAX(b.paid_at) FROM bills b WHERE b.customer_id=c.id AND b.status='paid') AS last_visit,
        (SELECT COUNT(*) FROM bills b WHERE b.customer_id=c.id AND b.status='paid') AS bill_count
        FROM customers c WHERE c.phone = ? AND c.active=1
    `, [phone]);

    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const [customer] = await query('SELECT * FROM customers WHERE id=?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const transactions = await query(`
      SELECT lt.*, b.table_number, u.name AS created_by_name
        FROM loyalty_transactions lt
        LEFT JOIN bills b ON b.id=lt.bill_id
        LEFT JOIN users u ON u.id=lt.created_by
       WHERE lt.customer_id=?
       ORDER BY lt.created_at DESC
       LIMIT 50
    `, [id]);

    const recentBills = await query(`
      SELECT b.id, b.total, b.payment_method, b.paid_at, b.table_number,
             b.loyalty_points_earned, b.loyalty_points_redeemed
        FROM bills b WHERE b.customer_id=? AND b.status='paid'
       ORDER BY b.paid_at DESC LIMIT 20
    `, [id]);

    res.json({ ...customer, transactions, recentBills });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, birthday, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    if (phone) {
      const existing = await query('SELECT id FROM customers WHERE phone=?', [phone]);
      if (existing.length) return res.status(409).json({ error: 'Customer with this phone already exists' });
    }

    const { lastId } = await run(
      `INSERT INTO customers (name, phone, email, birthday, notes) VALUES (?,?,?,?,?)`,
      [name, phone || null, email || null, birthday || null, notes || null]
    );
    const [customer] = await query('SELECT * FROM customers WHERE id=?', [lastId]);
    res.json(customer);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, birthday, notes, active } = req.body;
    await run(
      `UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone),
         email=COALESCE(?,email), birthday=COALESCE(?,birthday),
         notes=COALESCE(?,notes), active=COALESCE(?,active),
         updated_at=datetime('now') WHERE id=?`,
      [name, phone, email, birthday, notes, active, id]
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════════════════════
// LOYALTY
// ═══════════════════════════════════════════════════════════════════════════

// Called internally after a bill is paid — also called from route for manual adjust
const earnPoints = async (req, res) => {
  try {
    const { customer_id, bill_id, spend_amount, points_override } = req.body;

    const [settings] = await query('SELECT * FROM business_settings WHERE id=1');
    if (!settings?.loyalty_enabled) return res.json({ skipped: true, reason: 'Loyalty disabled' });

    const [customer] = await query('SELECT * FROM customers WHERE id=?', [customer_id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const rate         = settings.loyalty_points_per_100 || 1;
    const pointsEarned = points_override != null
      ? Number(points_override)
      : Math.floor((Number(spend_amount) || 0) / 100) * rate;

    if (pointsEarned <= 0) return res.json({ points_earned: 0 });

    const newPoints = customer.loyalty_points + pointsEarned;
    const newSpend  = customer.total_spend + (Number(spend_amount) || 0);
    const newVisits = customer.visit_count + 1;
    const newTier   = calcTier(newSpend, settings);

    await runTransaction([
      {
        sql: `UPDATE customers SET loyalty_points=?, total_spend=?, visit_count=?, tier=?, updated_at=datetime('now') WHERE id=?`,
        params: [newPoints, newSpend, newVisits, newTier, customer_id],
      },
      {
        sql: `INSERT INTO loyalty_transactions (customer_id, bill_id, type, points, spend_amount, description, created_by) VALUES (?,?,?,?,?,?,?)`,
        params: [customer_id, bill_id || null, 'earn', pointsEarned, spend_amount || 0, `Earned on bill #${bill_id || '—'}`, req.user?.id],
      },
    ]);

    if (bill_id) {
      await run(`UPDATE bills SET loyalty_points_earned=?, customer_id=? WHERE id=?`,
        [pointsEarned, customer_id, bill_id]);
    }

    res.json({ points_earned: pointsEarned, new_balance: newPoints, tier: newTier });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Redeem points for discount — returns discount amount
const redeemPoints = async (req, res) => {
  try {
    const { customer_id, points_to_redeem, bill_id } = req.body;

    const [settings] = await query('SELECT * FROM business_settings WHERE id=1');
    if (!settings?.loyalty_enabled) return res.status(400).json({ error: 'Loyalty is disabled' });

    const [customer] = await query('SELECT * FROM customers WHERE id=?', [customer_id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.loyalty_points < points_to_redeem) {
      return res.status(400).json({ error: `Insufficient points. Balance: ${customer.loyalty_points}` });
    }

    const redeemRate    = settings.loyalty_redeem_rate || 1; // KES per point
    const discountAmt   = points_to_redeem * redeemRate;
    const newPoints     = customer.loyalty_points - points_to_redeem;

    await runTransaction([
      {
        sql: `UPDATE customers SET loyalty_points=?, updated_at=datetime('now') WHERE id=?`,
        params: [newPoints, customer_id],
      },
      {
        sql: `INSERT INTO loyalty_transactions (customer_id, bill_id, type, points, spend_amount, description, created_by) VALUES (?,?,?,?,?,?,?)`,
        params: [customer_id, bill_id || null, 'redeem', -points_to_redeem, discountAmt, `Redeemed ${points_to_redeem} pts = KES ${discountAmt} discount`, req.user?.id],
      },
    ]);

    if (bill_id) {
      await run(`UPDATE bills SET loyalty_points_redeemed=?, loyalty_discount=?, customer_id=? WHERE id=?`,
        [points_to_redeem, discountAmt, customer_id, bill_id]);
    }

    res.json({ discount_amount: discountAmt, points_redeemed: points_to_redeem, new_balance: newPoints });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const manualAdjustPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;

    const [customer] = await query('SELECT * FROM customers WHERE id=?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const newPoints = Math.max(0, customer.loyalty_points + Number(points));
    await runTransaction([
      { sql: `UPDATE customers SET loyalty_points=?, updated_at=datetime('now') WHERE id=?`, params: [newPoints, id] },
      { sql: `INSERT INTO loyalty_transactions (customer_id, type, points, description, created_by) VALUES (?,?,?,?,?)`,
        params: [id, 'manual', Number(points), description || 'Manual adjustment', req.user?.id] },
    ]);
    res.json({ success: true, new_balance: newPoints });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

function calcTier(totalSpend, settings) {
  if (totalSpend >= (settings?.loyalty_platinum_threshold || 50000)) return 'platinum';
  if (totalSpend >= (settings?.loyalty_gold_threshold     || 20000)) return 'gold';
  if (totalSpend >= (settings?.loyalty_silver_threshold   ||  5000)) return 'silver';
  return 'bronze';
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

const getBusinessSettings = async (req, res) => {
  try {
    const [settings] = await query('SELECT * FROM business_settings WHERE id=1');
    res.json(settings || {});
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateBusinessSettings = async (req, res) => {
  try {
    const {
      business_name, tagline, phone, email, address, currency,
      tax_enabled, tax_rate, tax_label,
      service_charge_enabled, service_charge_rate, service_charge_label,
      loyalty_enabled, loyalty_points_per_100, loyalty_redeem_rate,
      loyalty_silver_threshold, loyalty_gold_threshold, loyalty_platinum_threshold,
      receipt_footer,
    } = req.body;

    await run(`
      UPDATE business_settings SET
        business_name=COALESCE(?,business_name),
        tagline=COALESCE(?,tagline),
        phone=COALESCE(?,phone),
        email=COALESCE(?,email),
        address=COALESCE(?,address),
        currency=COALESCE(?,currency),
        tax_enabled=COALESCE(?,tax_enabled),
        tax_rate=COALESCE(?,tax_rate),
        tax_label=COALESCE(?,tax_label),
        service_charge_enabled=COALESCE(?,service_charge_enabled),
        service_charge_rate=COALESCE(?,service_charge_rate),
        service_charge_label=COALESCE(?,service_charge_label),
        loyalty_enabled=COALESCE(?,loyalty_enabled),
        loyalty_points_per_100=COALESCE(?,loyalty_points_per_100),
        loyalty_redeem_rate=COALESCE(?,loyalty_redeem_rate),
        loyalty_silver_threshold=COALESCE(?,loyalty_silver_threshold),
        loyalty_gold_threshold=COALESCE(?,loyalty_gold_threshold),
        loyalty_platinum_threshold=COALESCE(?,loyalty_platinum_threshold),
        receipt_footer=COALESCE(?,receipt_footer),
        updated_at=datetime('now')
      WHERE id=1
    `, [
      business_name, tagline, phone, email, address, currency,
      tax_enabled, tax_rate, tax_label,
      service_charge_enabled, service_charge_rate, service_charge_label,
      loyalty_enabled, loyalty_points_per_100, loyalty_redeem_rate,
      loyalty_silver_threshold, loyalty_gold_threshold, loyalty_platinum_threshold,
      receipt_footer,
    ]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

const getInsights = async (req, res) => {
  try {
    const { from, to } = req.query;
    const today     = new Date().toISOString().split('T')[0];
    const fromDate  = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate    = to   || today;

    // Check if active column exists in menu_items
    let menuColumns = await query("PRAGMA table_info(menu_items)");
    let hasActiveColumn = menuColumns.some(col => col.name === 'active');
    
    // Top selling items
    const topItems = await query(`
      SELECT mi.name, mi.image_emoji, mc.name AS category,
             SUM(oi.quantity) AS qty_sold,
             SUM(oi.quantity * oi.unit_price) AS revenue,
             COUNT(DISTINCT o.id) AS order_count
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        JOIN menu_categories mc ON mc.id = mi.category_id
        JOIN orders o ON o.id = oi.order_id
       WHERE o.status='paid' AND date(o.updated_at) BETWEEN ? AND ?
       ${hasActiveColumn ? 'AND mi.active = 1' : ''}
       GROUP BY mi.id ORDER BY revenue DESC LIMIT 10
    `, [fromDate, toDate]);

    // Slowest items
    const slowItems = await query(`
      SELECT mi.name, mi.image_emoji, mc.name AS category,
             COALESCE(SUM(oi.quantity), 0) AS qty_sold,
             COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
        FROM menu_items mi
        JOIN menu_categories mc ON mc.id = mi.category_id
        LEFT JOIN order_items oi ON oi.menu_item_id = mi.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status='paid'
              AND date(o.updated_at) BETWEEN ? AND ?
       ${hasActiveColumn ? 'WHERE mi.active=1' : ''}
       GROUP BY mi.id ORDER BY qty_sold ASC LIMIT 10
    `, [fromDate, toDate]);

    // Rest of the function remains the same...
    // Peak hours
    const peakHours = await query(`
      SELECT strftime('%H', o.created_at) AS hour,
             COUNT(DISTINCT o.id) AS order_count,
             COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status='paid' AND date(o.updated_at) BETWEEN ? AND ?
       GROUP BY hour ORDER BY hour ASC
    `, [fromDate, toDate]);

    // Average bill per day
    const avgBill = await query(`
      SELECT ROUND(AVG(total), 2) AS avg_bill,
             MAX(total) AS max_bill,
             MIN(total) AS min_bill,
             COUNT(*) AS bill_count
        FROM bills WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?
    `, [fromDate, toDate]);

    // Top waiters by revenue
    const topWaiters = await query(`
      SELECT u.name AS waiter_name, u.role,
             COUNT(DISTINCT o.id) AS orders_served,
             COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
             COALESCE(AVG(b.total), 0) AS avg_bill_value
        FROM users u
        JOIN orders o ON o.waiter_id = u.id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN bills b ON b.order_id = o.id
       WHERE o.status='paid' AND u.role IN ('waiter','bar_attendant')
         AND date(o.updated_at) BETWEEN ? AND ?
       GROUP BY u.id ORDER BY revenue DESC LIMIT 10
    `, [fromDate, toDate]);

    // Payment method split
    const paymentSplit = await query(`
      SELECT payment_method,
             COUNT(*) AS count,
             SUM(total) AS total
        FROM bills WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?
       GROUP BY payment_method
    `, [fromDate, toDate]);

    // Day of week patterns
    const dayOfWeek = await query(`
      SELECT CASE strftime('%w', paid_at)
               WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue'
               WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri'
               ELSE 'Sat' END AS day,
             COUNT(*) AS orders, SUM(total) AS revenue
        FROM bills WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?
       GROUP BY strftime('%w', paid_at) ORDER BY strftime('%w', paid_at)
    `, [fromDate, toDate]);

    // Repeat customer rate
    const loyaltyStats = await query(`
      SELECT COUNT(*) AS total_customers,
             COUNT(CASE WHEN visit_count > 1 THEN 1 END) AS repeat_customers,
             SUM(loyalty_points) AS total_points_outstanding,
             COUNT(CASE WHEN tier IN ('gold','platinum') THEN 1 END) AS vip_customers
        FROM customers WHERE active=1
    `);

    res.json({
      topItems, slowItems, peakHours, avgBill: avgBill[0] || {},
      topWaiters, paymentSplit, dayOfWeek,
      loyaltyStats: loyaltyStats[0] || {},
      from: fromDate, to: toDate,
    });
  } catch(err) { 
    console.error('Insights error:', err);
    res.status(500).json({ error: err.message }); 
  }
};

// Quick stats for topbar / dashboard widget
const getQuickStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [revenue]  = await query(`SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS bills FROM bills WHERE status='paid' AND date(paid_at)=?`, [today]);
    const [tables]   = await query(`SELECT COUNT(CASE WHEN status='occupied' THEN 1 END) AS occupied, COUNT(*) AS total FROM restaurant_tables WHERE type='table'`);
    const [orders]   = await query(`SELECT COUNT(*) AS pending FROM orders WHERE status IN ('pending','preparing')`);
    const [lowStock] = await query(`SELECT COUNT(*) AS count FROM inventory WHERE quantity <= reorder_level`);
    const [unpaidBills] = await query(`SELECT COUNT(*) AS count FROM bills WHERE status='unpaid'`);

    res.json({
      today_revenue: revenue?.revenue || 0,
      today_bills:   revenue?.bills   || 0,
      tables_occupied: tables?.occupied || 0,
      tables_total:    tables?.total    || 0,
      pending_orders:  orders?.pending  || 0,
      low_stock_count: lowStock?.count  || 0,
      unpaid_bills:    unpaidBills?.count || 0,
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTO BACKUP
// ═══════════════════════════════════════════════════════════════════════════

const triggerBackup = async (req, res) => {
  try {
    const result = await performBackup('manual', req.user?.id);
    res.json(result);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getBackupList = async (req, res) => {
  try {
    const backups = await query('SELECT * FROM backups ORDER BY created_at DESC LIMIT 30');
    res.json(backups);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

async function performBackup(type = 'auto', userId = null) {
  const { getDB, saveDB } = require('../models/database');
  const db = await getDB();

  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `sai_lounge_${type}_${ts}.db`;
  const filepath = path.join(backupDir, filename);

  // Export current DB state
  const data = db.export();
  fs.writeFileSync(filepath, Buffer.from(data));

  const stats    = fs.statSync(filepath);
  const sizeBytes = stats.size;

  // Prune — keep only last 14 auto backups
  if (type === 'auto') {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('sai_lounge_auto_'))
      .sort();
    while (files.length > 14) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(backupDir, oldest)); } catch {}
    }
  }

  // Log to DB
  await run(
    `INSERT INTO backups (filename, size_bytes, type, status) VALUES (?,?,?,'success')`,
    [filename, sizeBytes, type]
  );

  console.log(`💾 Backup created: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  return { filename, size_bytes: sizeBytes, type };
}

module.exports = {
  // Customers
  getCustomers, lookupCustomer, getCustomer, createCustomer, updateCustomer,
  // Loyalty
  earnPoints, redeemPoints, manualAdjustPoints,
  // Settings
  getBusinessSettings, updateBusinessSettings,
  // Insights
  getInsights, getQuickStats,
  // Backup
  triggerBackup, getBackupList, performBackup,
};
