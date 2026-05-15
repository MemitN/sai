const { query, run, saveDB } = require('../models/database');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sales = await query(`SELECT COUNT(*) as order_count,COALESCE(SUM(total),0) as total_sales,COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) as cash_sales,COALESCE(SUM(CASE WHEN payment_method='mpesa' THEN total ELSE 0 END),0) as mpesa_sales,COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) as card_sales FROM bills WHERE status='paid' AND date(paid_at)=?`, [today]);
    const lowStock = await query(`SELECT COUNT(*) as count FROM inventory WHERE quantity <= reorder_level`);
    const tables = await query(`SELECT COUNT(CASE WHEN status='occupied' THEN 1 END) as occupied,COUNT(CASE WHEN status='free' THEN 1 END) as free,COUNT(CASE WHEN status='billing' THEN 1 END) as billing,COUNT(*) as total FROM restaurant_tables WHERE type='table'`);
    const weeklySales = await query(`SELECT date(paid_at) as date,COALESCE(SUM(total),0) as total,COUNT(*) as orders FROM bills WHERE status='paid' AND paid_at>=datetime('now','-7 days') GROUP BY date(paid_at) ORDER BY date ASC`);
    const topItems = await query(`SELECT m.name,m.image_emoji,SUM(oi.quantity) as qty_sold,SUM(oi.quantity*oi.unit_price) as revenue FROM order_items oi JOIN menu_items m ON m.id=oi.menu_item_id JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND o.updated_at>=datetime('now','-7 days') GROUP BY m.id ORDER BY qty_sold DESC LIMIT 10`);
    const categoryBreakdown = await query(`SELECT mc.name as category,mc.icon,mc.department,SUM(oi.quantity*oi.unit_price) as revenue FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id JOIN menu_categories mc ON mc.id=mi.category_id JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND date(o.updated_at)=? GROUP BY mc.id ORDER BY revenue DESC`, [today]);
    const activeShift = await query(`SELECT s.*,u.name as user_name FROM shifts s JOIN users u ON u.id=s.user_id WHERE s.status='open' ORDER BY s.opened_at DESC LIMIT 1`);
    const lowStockItems = await query(`SELECT * FROM inventory WHERE quantity <= reorder_level ORDER BY (quantity/reorder_level) ASC LIMIT 10`);
    res.json({ today: sales[0]||{order_count:0,total_sales:0}, lowStockCount: lowStock[0]?.count||0, tables: tables[0]||{}, weeklySales, topItems, categoryBreakdown, activeShift: activeShift[0]||null, lowStockItems });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getSalesReport = async (req, res) => {
  try {
    const { from, to, type='daily' } = req.query;
    const fromDate = from || new Date(Date.now()-30*86400000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];
    const sales = await query(`SELECT date(b.paid_at) as date,COUNT(*) as bill_count,SUM(b.total) as total_sales,SUM(b.discount) as total_discounts,SUM(CASE WHEN b.payment_method='cash' THEN b.total ELSE 0 END) as cash,SUM(CASE WHEN b.payment_method='mpesa' THEN b.total ELSE 0 END) as mpesa,SUM(CASE WHEN b.payment_method='card' THEN b.total ELSE 0 END) as card FROM bills b WHERE b.status='paid' AND date(b.paid_at) BETWEEN ? AND ? GROUP BY date(b.paid_at) ORDER BY date ASC`, [fromDate, toDate]);
    const totals = await query(`SELECT COUNT(*) as bill_count,COALESCE(SUM(total),0) as total_sales,COALESCE(SUM(discount),0) as total_discounts,COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) as cash,COALESCE(SUM(CASE WHEN payment_method='mpesa' THEN total ELSE 0 END),0) as mpesa,COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) as card FROM bills WHERE status='paid' AND date(paid_at) BETWEEN ? AND ?`, [fromDate, toDate]);
    const byDepartment = await query(`SELECT mc.department,mc.name as category,SUM(oi.quantity*oi.unit_price) as revenue,SUM(oi.quantity) as qty FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id JOIN menu_categories mc ON mc.id=mi.category_id JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND date(o.updated_at) BETWEEN ? AND ? GROUP BY mc.department,mc.id ORDER BY mc.department,revenue DESC`, [fromDate, toDate]);
    const itemSales = await query(`SELECT mi.name,mc.name as category,mc.department,SUM(oi.quantity) as qty,SUM(oi.quantity*oi.unit_price) as revenue FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id JOIN menu_categories mc ON mc.id=mi.category_id JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND date(o.updated_at) BETWEEN ? AND ? GROUP BY mi.id ORDER BY revenue DESC`, [fromDate, toDate]);
    res.json({ sales, totals: totals[0], byDepartment, itemSales, from: fromDate, to: toDate });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getInventoryReport = async (req, res) => {
  try {
    const { dept } = req.query;
    let sql = `SELECT i.*,s.name as supplier_name,(i.quantity*i.cost_price) as stock_value,CASE WHEN i.quantity<=0 THEN 'out_of_stock' WHEN i.quantity<=i.reorder_level THEN 'low' ELSE 'ok' END as stock_status FROM inventory i LEFT JOIN suppliers s ON s.id=i.supplier_id`;
    if (dept) sql += ` WHERE i.department=?`;
    sql += ` ORDER BY i.department,i.category,i.name`;
    const items = dept ? await query(sql, [dept]) : await query(sql);
    const movements = await query(`SELECT im.*,i.name as item_name,u.name as user_name FROM inventory_movements im JOIN inventory i ON i.id=im.inventory_id LEFT JOIN users u ON u.id=im.user_id WHERE im.created_at>=datetime('now','-30 days') ORDER BY im.created_at DESC LIMIT 100`);
    const summary = await query(`SELECT department,COUNT(*) as items,SUM(quantity*cost_price) as total_value,COUNT(CASE WHEN quantity<=reorder_level THEN 1 END) as low_items FROM inventory GROUP BY department`);
    res.json({ items, movements, summary, lowCount: items.filter(i=>i.stock_status!=='ok').length });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getStockReport = async (req, res) => {
  try {
    const { period='daily', dept } = req.query;
    let dateFilter = "date(im.created_at)=date('now')";
    if (period==='weekly') dateFilter = "im.created_at>=datetime('now','-7 days')";
    if (period==='monthly') dateFilter = "im.created_at>=datetime('now','-30 days')";
    let deptFilter = dept ? `AND i.department='${dept}'` : '';
    const movements = await query(`SELECT i.name,i.department,i.category,i.unit,SUM(CASE WHEN im.movement_type='purchase' THEN im.quantity ELSE 0 END) as received,SUM(CASE WHEN im.movement_type='usage' THEN im.quantity ELSE 0 END) as used,SUM(CASE WHEN im.movement_type='requisition' THEN im.quantity ELSE 0 END) as requisitioned,i.quantity as closing_stock FROM inventory i LEFT JOIN inventory_movements im ON im.inventory_id=i.id AND ${dateFilter} WHERE 1=1 ${deptFilter} GROUP BY i.id ORDER BY i.department,i.name`);
    res.json({ movements, period, dept });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getWaiterCommissions = async (req, res) => {
  try {
    const { from, to, period='daily' } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || today;
    const toDate = to || today;
    const commissions = await query(`SELECT u.name as waiter_name,u.id as waiter_id,u.commission_rate,COUNT(DISTINCT o.id) as orders_served,COALESCE(SUM(oi.quantity*oi.unit_price),0) as total_sales,COALESCE(SUM(oi.quantity*oi.unit_price)*(COALESCE(u.commission_rate,3)/100),0) as commission FROM users u LEFT JOIN orders o ON o.waiter_id=u.id AND date(o.updated_at) BETWEEN ? AND ? AND o.status='paid' LEFT JOIN order_items oi ON oi.order_id=o.id WHERE u.role IN ('waiter','bar_attendant') AND u.active=1 GROUP BY u.id ORDER BY total_sales DESC`, [fromDate, toDate]);
    const waiterSales = await query(`SELECT u.name as waiter_name,mi.name as item_name,mc.name as category,SUM(oi.quantity) as qty,SUM(oi.quantity*oi.unit_price) as revenue FROM users u JOIN orders o ON o.waiter_id=u.id JOIN order_items oi ON oi.order_id=o.id JOIN menu_items mi ON mi.id=oi.menu_item_id JOIN menu_categories mc ON mc.id=mi.category_id WHERE u.role IN ('waiter','bar_attendant') AND o.status='paid' AND date(o.updated_at) BETWEEN ? AND ? GROUP BY u.id,mi.id ORDER BY u.name,revenue DESC`, [fromDate, toDate]);
    res.json({ commissions, waiterSales, from: fromDate, to: toDate });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getPurchaseReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now()-30*86400000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];
    const purchases = await query(`SELECT po.*,s.name as supplier_name,u.name as created_by FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id LEFT JOIN users u ON u.id=po.user_id WHERE date(po.created_at) BETWEEN ? AND ? ORDER BY po.created_at DESC`, [fromDate, toDate]);
    const items = await query(`SELECT poi.*,i.name as item_name,i.unit,s.name as supplier_name,date(po.created_at) as order_date FROM purchase_order_items poi JOIN purchase_orders po ON po.id=poi.purchase_order_id JOIN inventory i ON i.id=poi.inventory_id JOIN suppliers s ON s.id=po.supplier_id WHERE date(po.created_at) BETWEEN ? AND ? ORDER BY po.created_at DESC`, [fromDate, toDate]);
    const totals = await query(`SELECT COUNT(*) as count,COALESCE(SUM(total_amount),0) as total FROM purchase_orders WHERE date(created_at) BETWEEN ? AND ?`, [fromDate, toDate]);
    res.json({ purchases, items, totals: totals[0], from: fromDate, to: toDate });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getFastSlowItems = async (req, res) => {
  try {
    const items = await query(`SELECT mi.name,mc.name as category,mc.department,SUM(oi.quantity) as qty_sold,SUM(oi.quantity*oi.unit_price) as revenue FROM menu_items mi LEFT JOIN order_items oi ON oi.menu_item_id=mi.id LEFT JOIN orders o ON o.id=oi.order_id AND o.status='paid' AND o.updated_at>=datetime('now','-30 days') LEFT JOIN menu_categories mc ON mc.id=mi.category_id WHERE mi.available=1 GROUP BY mi.id ORDER BY qty_sold DESC`);
    const total = items.reduce((s,i)=>s+(i.qty_sold||0),0);
    const enriched = items.map((item,idx)=>({...item, rank: idx+1, velocity: total>0?((item.qty_sold||0)/total*100).toFixed(1):0, classification: idx<items.length*0.2?'fast':idx>items.length*0.8?'slow':'medium'}));
    res.json({ items: enriched });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, name, reorder_level, cost_price, movement_type='adjustment', notes='' } = req.body;
    const old = await query("SELECT * FROM inventory WHERE id=?", [id]);
    if (!old.length) return res.status(404).json({error:'Not found'});
    const diff = quantity - old[0].quantity;
    await run("UPDATE inventory SET quantity=?,name=?,reorder_level=?,cost_price=?,updated_at=datetime('now') WHERE id=?", [quantity, name, reorder_level, cost_price||old[0].cost_price, id]);
    if (diff !== 0) {
      await run("INSERT INTO inventory_movements (inventory_id,movement_type,quantity,user_id,notes,created_at) VALUES (?,?,?,?,?,datetime('now'))", [id, diff>0?'purchase':'usage', Math.abs(diff), req.user?.id, notes]);
    }
    if (quantity <= reorder_level && quantity > 0) {
      await run("INSERT INTO notifications (type,message,for_roles,created_at) VALUES (?,?,?,datetime('now'))", ['low_stock', `Low stock alert: ${name} has only ${quantity} ${old[0].unit} remaining`, 'admin,management,cashier']);
    } else if (quantity <= 0) {
      await run("INSERT INTO notifications (type,message,for_roles,created_at) VALUES (?,?,?,datetime('now'))", ['out_of_stock', `OUT OF STOCK: ${name} is completely out of stock`, 'admin,management,cashier']);
    }
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

const addInventoryItem = async (req, res) => {
  try {
    const { name, category, department='kitchen', quantity, unit, reorder_level, cost_price, supplier_id } = req.body;
    const { lastId } = await run("INSERT INTO inventory (name,category,department,quantity,unit,reorder_level,cost_price,supplier_id) VALUES (?,?,?,?,?,?,?,?)", [name, category, department, quantity, unit, reorder_level, cost_price, supplier_id||null]);
    const items = await query("SELECT * FROM inventory WHERE id=?", [lastId]);
    res.json(items[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getUsers = async (req, res) => {
  try {
    const users = await query("SELECT id,name,code,role,active,commission_rate,email,phone,created_at FROM users ORDER BY role,name");
    res.json(users);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const createUser = async (req, res) => {
  try {
    const { name, code, role, email, phone, commission_rate=3 } = req.body;
    const { lastId } = await run("INSERT INTO users (name,code,role,email,phone,commission_rate) VALUES (?,?,?,?,?,?)", [name, code, role, email||null, phone||null, commission_rate]);
    const users = await query("SELECT id,name,code,role,active,commission_rate,email,phone FROM users WHERE id=?", [lastId]);
    res.json(users[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, role, active, email, phone, commission_rate } = req.body;
    await run("UPDATE users SET name=?,code=?,role=?,active=?,email=?,phone=?,commission_rate=? WHERE id=?", [name, code, role, active!==undefined?active:1, email||null, phone||null, commission_rate||3, id]);
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await run("UPDATE users SET active=0 WHERE id=?", [id]);
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

const getNotifications = async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const notifications = await query(`SELECT * FROM notifications WHERE for_roles LIKE ? ORDER BY created_at DESC LIMIT 50`, [`%${role}%`]);
    res.json(notifications);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id?.toString();
    const notif = await query("SELECT * FROM notifications WHERE id=?", [id]);
    if (!notif.length) return res.status(404).json({error:'Not found'});
    const readBy = notif[0].read_by ? notif[0].read_by.split(',').filter(Boolean) : [];
    if (!readBy.includes(userId)) readBy.push(userId);
    await run("UPDATE notifications SET read_by=? WHERE id=?", [readBy.join(','), id]);
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

// ==================== REQUISITIONS ====================
const getRequisitions = async (req, res) => {
  try {
    const { period = 'daily', from, to, department } = req.query;
    let dateFilter = "date(r.created_at) = date('now')";
    if (period === 'weekly') dateFilter = "r.created_at >= datetime('now', '-7 days')";
    if (period === 'monthly') dateFilter = "r.created_at >= datetime('now', '-30 days')";
    if (period === 'custom' && from && to) dateFilter = `date(r.created_at) BETWEEN '${from}' AND '${to}'`;
    
    let deptFilter = department && department !== 'all' ? `AND r.department = '${department}'` : '';
    
    const requisitions = await query(`
      SELECT r.*, 
        (SELECT json_group_array(json_object('name', i.name, 'quantity', ri.quantity, 'unit', i.unit))
         FROM requisition_items ri 
         JOIN inventory i ON i.id = ri.inventory_id 
         WHERE ri.requisition_id = r.id) as items_json,
        a.name as approved_by_name,
        iss.name as issued_by_name
      FROM requisitions r
      LEFT JOIN users a ON a.id = r.approved_by
      LEFT JOIN users iss ON iss.id = r.issued_by
      WHERE ${dateFilter} ${deptFilter}
      ORDER BY r.created_at DESC
    `);
    
    const requisitionsWithItems = requisitions.map(r => ({
      ...r,
      items: r.items_json ? JSON.parse(r.items_json) : []
    }));
    
    const summary = await query(`
      SELECT 
        COUNT(*) as total_requisitions,
        COALESCE((SELECT SUM(quantity) FROM requisition_items WHERE requisition_id IN (SELECT id FROM requisitions r2 WHERE ${dateFilter.replace(/r\./g, 'r2.')} ${deptFilter.replace(/r\./g, 'r2.')})), 0) as total_items,
        SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN r.status IN ('approved', 'issued') THEN 1 ELSE 0 END) as completed_count
      FROM requisitions r
      WHERE ${dateFilter} ${deptFilter}
    `);
    
    res.json({ requisitions: requisitionsWithItems, summary: summary[0] || { total_requisitions: 0, total_items: 0, pending_count: 0, completed_count: 0 } });
  } catch(err) { 
    console.error('Requisitions error:', err);
    res.status(500).json({ error: err.message }); 
  }
};

const createRequisition = async (req, res) => {
  try {
    const { department, items, notes, requested_by } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });
    
    const { lastId } = await run(
      "INSERT INTO requisitions (department, requested_by, notes, status) VALUES (?, ?, ?, 'pending')",
      [department, requested_by, notes || null]
    );
    
    for (const item of items) {
      await run(
        "INSERT INTO requisition_items (requisition_id, inventory_id, quantity) VALUES (?, ?, ?)",
        [lastId, item.inventory_id, item.quantity]
      );
    }
    
    // Create notification for management
    await run(
      "INSERT INTO notifications (type, message, for_roles, created_at) VALUES (?, ?, ?, datetime('now'))",
      ['requisition', `New requisition #${lastId} from ${requested_by} (${department})`, 'admin,management']
    );
    
    res.json({ success: true, id: lastId });
  } catch(err) { 
    res.status(500).json({ error: err.message }); 
  }
};

const updateRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.name;
    
    let updateField = '';
    if (status === 'approved') updateField = 'approved_by';
    if (status === 'issued') updateField = 'issued_by';
    
    if (updateField) {
      await run(`UPDATE requisitions SET status = ?, ${updateField} = ?, updated_at = datetime('now') WHERE id = ?`, [status, userId, id]);
      
      // If issuing, update inventory quantities
      if (status === 'issued') {
        const items = await query("SELECT * FROM requisition_items WHERE requisition_id = ?", [id]);
        for (const item of items) {
          const inventory = await query("SELECT * FROM inventory WHERE id = ?", [item.inventory_id]);
          if (inventory.length) {
            const newQty = Math.max(0, inventory[0].quantity - item.quantity);
            await run("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?", [newQty, item.inventory_id]);
            await run(
              "INSERT INTO inventory_movements (inventory_id, movement_type, quantity, user_id, notes, created_at) VALUES (?, 'requisition', ?, ?, ?, datetime('now'))",
              [item.inventory_id, item.quantity, userId, `Requisition #${id}`]
            );
          }
        }
      }
    } else {
      await run("UPDATE requisitions SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
    }
    
    // Send notification about status update
    const requisition = await query("SELECT * FROM requisitions WHERE id = ?", [id]);
    if (requisition.length) {
      await run(
        "INSERT INTO notifications (type, message, for_roles, created_at) VALUES (?, ?, ?, datetime('now'))",
        ['requisition', `Requisition #${id} has been ${status} by ${userName || 'staff'}`, requisition[0].department]
      );
    }
    
    res.json({ success: true });
  } catch(err) { 
    res.status(500).json({ error: err.message }); 
  }
};

// ==================== SHIFTS ====================
const getShifts = async (req, res) => {
  try {
    const shifts = await query(`SELECT s.*,u.name as user_name FROM shifts s JOIN users u ON u.id=s.user_id ORDER BY s.opened_at DESC LIMIT 50`);
    res.json(shifts);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const openShift = async (req, res) => {
  try {
    const { opening_float=0 } = req.body;
    const userId = req.user?.id;
    const existing = await query("SELECT * FROM shifts WHERE user_id=? AND status='open'", [userId]);
    if (existing.length) return res.json(existing[0]);
    const { lastId } = await run("INSERT INTO shifts (user_id,opening_float,status) VALUES (?,?,'open')", [userId, opening_float]);
    const shift = await query("SELECT s.*,u.name as user_name FROM shifts s JOIN users u ON u.id=s.user_id WHERE s.id=?", [lastId]);
    if (req.io) req.io.emit('shift:opened', shift[0]);
    res.json(shift[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const closeShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { closing_cash=0, closing_mpesa=0, closing_card=0, notes='' } = req.body;
    const shift = await query("SELECT * FROM shifts WHERE id=?", [id]);
    if (!shift.length) return res.status(404).json({error:'Shift not found'});
    const sales = await query(`SELECT COALESCE(SUM(total),0) as total FROM bills WHERE status='paid' AND paid_at>=?`, [shift[0].opened_at]);
    const totalSales = sales[0]?.total || 0;
    await run("UPDATE shifts SET status='closed',closed_at=datetime('now'),closing_cash=?,closing_mpesa=?,closing_card=?,total_sales=?,notes=? WHERE id=?",
      [closing_cash, closing_mpesa, closing_card, totalSales, notes, id]);
    const updated = await query("SELECT s.*,u.name as user_name FROM shifts s JOIN users u ON u.id=s.user_id WHERE s.id=?", [id]);
    if (req.io) req.io.emit('shift:closed', updated[0]);
    res.json(updated[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

// ==================== M-PESA ====================
const initiateMpesa = async (req, res) => {
  try {
    const { phone, amount, bill_id } = req.body;
    
    // Generate a unique checkout request ID for tracking
    const tempCheckoutId = `TMP${Date.now()}${Math.floor(Math.random() * 10000)}`;
    
    // Create pending transaction record
    await run(`
      INSERT INTO mpesa_pending_transactions 
        (checkout_request_id, bill_id, amount, phone, status, created_at) 
      VALUES (?, ?, ?, ?, 'pending', datetime('now'))
    `, [tempCheckoutId, bill_id, amount, phone]);
    
    const settings = await query("SELECT * FROM mpesa_settings LIMIT 1");
    if (!settings.length || !settings[0].consumer_key) {
      return res.status(400).json({error: 'M-Pesa not configured. Please set up M-Pesa credentials in Settings.'});
    }
    
    const s = settings[0];
    
    // Get access token
    const authRes = await fetch(`https://${s.environment === 'production' ? 'api' : 'sandbox'}.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { 
        Authorization: 'Basic ' + Buffer.from(`${s.consumer_key}:${s.consumer_secret}`).toString('base64') 
      }
    });
    
    if (!authRes.ok) {
      throw new Error(`Failed to get access token: ${authRes.status}`);
    }
    
    const { access_token } = await authRes.json();
    
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${s.shortcode}${s.passkey}${timestamp}`).toString('base64');
    
    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phone.replace(/^\+?0?/, '254');
    if (!formattedPhone.match(/^254/)) {
      formattedPhone = '254' + formattedPhone.replace(/^0/, '');
    }
    
    const stkRes = await fetch(`https://${s.environment === 'production' ? 'api' : 'sandbox'}.safaricom.co.ke/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${access_token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        BusinessShortCode: s.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: formattedPhone,
        PartyB: s.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: s.callback_url || `${process.env.BACKEND_URL || 'https://your-domain.com'}/api/mpesa/callback`,
        AccountReference: `Bill#${bill_id}`,
        TransactionDesc: 'Sai Lounge Payment'
      })
    });
    
    const result = await stkRes.json();
    
    // Update with actual checkout request ID from Safaricom
    if (result.CheckoutRequestID) {
      await run(
        "UPDATE mpesa_pending_transactions SET checkout_request_id = ? WHERE checkout_request_id = ?",
        [result.CheckoutRequestID, tempCheckoutId]
      );
    }
    
    res.json(result);
  } catch(err) { 
    console.error('M-Pesa initiate error:', err);
    res.status(500).json({ error: err.message }); 
  }
};

// M-Pesa Callback Handler - Receives confirmation from Safaricom
const mpesaCallback = async (req, res) => {
  try {
    console.log('📱 M-Pesa Callback received:', JSON.stringify(req.body, null, 2));
    
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      console.log('Invalid callback structure');
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback structure' });
    }
    
    const resultCode = Body.stkCallback.ResultCode;
    const resultDesc = Body.stkCallback.ResultDesc;
    const checkoutRequestID = Body.stkCallback.CheckoutRequestID;
    const amount = Body.stkCallback.CallbackMetadata?.Item?.find(i => i.Name === 'Amount')?.Value;
    const mpesaReceipt = Body.stkCallback.CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
    const transactionDate = Body.stkCallback.CallbackMetadata?.Item?.find(i => i.Name === 'TransactionDate')?.Value;
    const phoneNumber = Body.stkCallback.CallbackMetadata?.Item?.find(i => i.Name === 'PhoneNumber')?.Value;
    
    if (resultCode === '0') {
      // Payment successful
      console.log(`✅ M-Pesa payment successful: ${mpesaReceipt} - ${amount} KES`);
      
      // Find the pending transaction
      const pending = await query(
        "SELECT * FROM mpesa_pending_transactions WHERE checkout_request_id = ? AND status = 'pending'",
        [checkoutRequestID]
      );
      
      if (pending.length > 0) {
        const transaction = pending[0];
        
        // Update the bill as paid
        await run(`
          UPDATE bills SET 
            status = 'paid',
            payment_method = 'mpesa',
            mpesa_amount = ?,
            mpesa_ref = ?,
            paid_at = datetime('now')
          WHERE id = ?
        `, [amount || transaction.amount, mpesaReceipt, transaction.bill_id]);
        
        // Update order status
        const bill = await query("SELECT order_id, table_id FROM bills WHERE id = ?", [transaction.bill_id]);
        if (bill.length) {
          await run("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?", [bill[0].order_id]);
          
          // Free the table if exists
          if (bill[0].table_id) {
            await run("UPDATE restaurant_tables SET status = 'free' WHERE id = ?", [bill[0].table_id]);
          }
        }
        
        // Update transaction status
        await run(
          `UPDATE mpesa_pending_transactions SET 
            status = 'completed', 
            mpesa_receipt = ?, 
            completed_at = datetime('now') 
          WHERE checkout_request_id = ?`,
          [mpesaReceipt, checkoutRequestID]
        );
        
        // Emit socket event
        if (req.io) {
          req.io.emit('bill:paid', { 
            bill_id: transaction.bill_id, 
            table_id: bill[0]?.table_id,
            mpesa_receipt: mpesaReceipt
          });
        }
        
        console.log(`✅ Bill ${transaction.bill_id} marked as paid via M-Pesa`);
      } else {
        console.log(`⚠️ No pending transaction found for ${checkoutRequestID}`);
      }
    } else {
      // Payment failed
      console.log(`❌ M-Pesa payment failed: ${resultDesc}`);
      
      await run(
        `UPDATE mpesa_pending_transactions 
         SET status = 'failed', 
             error_message = ?, 
             completed_at = datetime('now') 
         WHERE checkout_request_id = ?`,
        [resultDesc, checkoutRequestID]
      );
    }
    
    // Always respond with success to Safaricom
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('M-Pesa callback error:', err.message);
    res.json({ ResultCode: 1, ResultDesc: err.message });
  }
};

// ==================== SETTINGS ====================
const getSettings = async (req, res) => {
  try {
    const email = await query("SELECT smtp_host,smtp_port,smtp_user,from_email,from_name,report_emails,send_eod_report FROM email_settings LIMIT 1");
    const mpesa = await query("SELECT shortcode,environment,callback_url FROM mpesa_settings LIMIT 1");
    res.json({ email: email[0]||{}, mpesa: mpesa[0]||{} });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updateEmailSettings = async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name, report_emails, send_eod_report } = req.body;
    const existing = await query("SELECT id FROM email_settings LIMIT 1");
    if (existing.length) {
      await run("UPDATE email_settings SET smtp_host=?,smtp_port=?,smtp_user=?,smtp_pass=CASE WHEN ?!='' THEN ? ELSE smtp_pass END,from_email=?,from_name=?,report_emails=?,send_eod_report=?,updated_at=datetime('now') WHERE id=?",
        [smtp_host, smtp_port, smtp_user, smtp_pass, smtp_pass, from_email, from_name, report_emails, send_eod_report?1:0, existing[0].id]);
    } else {
      await run("INSERT INTO email_settings (smtp_host,smtp_port,smtp_user,smtp_pass,from_email,from_name,report_emails,send_eod_report) VALUES (?,?,?,?,?,?,?,?)",
        [smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name, report_emails, send_eod_report?1:0]);
    }
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updateMpesaSettings = async (req, res) => {
  try {
    const { shortcode, passkey, consumer_key, consumer_secret, callback_url, environment } = req.body;
    const existing = await query("SELECT id FROM mpesa_settings LIMIT 1");
    if (existing.length) {
      await run("UPDATE mpesa_settings SET shortcode=?,passkey=CASE WHEN ?!='' THEN ? ELSE passkey END,consumer_key=?,consumer_secret=CASE WHEN ?!='' THEN ? ELSE consumer_secret END,callback_url=?,environment=?,updated_at=datetime('now') WHERE id=?",
        [shortcode, passkey, passkey, consumer_key, consumer_secret, consumer_secret, callback_url, environment, existing[0].id]);
    } else {
      await run("INSERT INTO mpesa_settings (shortcode,passkey,consumer_key,consumer_secret,callback_url,environment) VALUES (?,?,?,?,?,?)",
        [shortcode, passkey, consumer_key, consumer_secret, callback_url, environment]);
    }
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

// ==================== SUPPLIERS ====================
const getSuppliers = async (req, res) => {
  try {
    const suppliers = await query("SELECT * FROM suppliers WHERE active=1 ORDER BY name");
    res.json(suppliers);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const createSupplier = async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, payment_terms } = req.body;
    const { lastId } = await run("INSERT INTO suppliers (name,contact_person,phone,email,address,payment_terms) VALUES (?,?,?,?,?,?)", [name, contact_person, phone, email, address, payment_terms]);
    const s = await query("SELECT * FROM suppliers WHERE id=?", [lastId]);
    res.json(s[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, payment_terms } = req.body;
    await run("UPDATE suppliers SET name=?,contact_person=?,phone=?,email=?,address=?,payment_terms=? WHERE id=?", [name, contact_person, phone, email, address, payment_terms, id]);
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

// ==================== PURCHASE ORDERS ====================
const getPurchaseOrders = async (req, res) => {
  try {
    const orders = await query(`
      SELECT po.*, s.name AS supplier_name, u.name AS created_by,
             (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id=po.id) AS item_count,
             (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id=po.id AND receive_status='full') AS items_received_full,
             (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id=po.id AND receive_status='partial') AS items_received_partial,
             (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id=po.id AND receive_status='missing') AS items_missing
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id=po.supplier_id
        LEFT JOIN users     u ON u.id=po.user_id
       ORDER BY po.created_at DESC
    `);

    // Attach line items to each order
    for (const po of orders) {
      po.items = await query(`
        SELECT poi.*, i.name AS item_name, i.unit, i.quantity AS current_stock
          FROM purchase_order_items poi
          JOIN inventory i ON i.id=poi.inventory_id
         WHERE poi.purchase_order_id=?
      `, [po.id]);
    }

    res.json(orders);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, items, notes, expected_date } = req.body;
    const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const { lastId } = await run(
      `INSERT INTO purchase_orders (supplier_id, user_id, total_amount, notes, expected_date, status, receive_status)
       VALUES (?,?,?,?,?,'pending','pending')`,
      [supplier_id, req.user?.id, total, notes, expected_date]
    );
    for (const item of items) {
      await run(
        `INSERT INTO purchase_order_items
           (purchase_order_id, inventory_id, quantity, unit_price, item_notes, receive_status)
         VALUES (?,?,?,?,?,'pending')`,
        [lastId, item.inventory_id, item.quantity, item.unit_price, item.notes || null]
      );
    }
    const [po] = await query('SELECT * FROM purchase_orders WHERE id=?', [lastId]);
    res.json(po);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Full or partial receive of a purchase order
const receivePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_comments, items: receivedItems = [] } = req.body;

    const [po] = await query('SELECT * FROM purchase_orders WHERE id=?', [id]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'cancelled') return res.status(400).json({ error: 'Cannot receive a cancelled order' });

    const poItems = await query('SELECT * FROM purchase_order_items WHERE purchase_order_id=?', [id]);

    let totalReceivedValue = 0;
    let anyShortage = false;
    let allFull = true;

    for (const poItem of poItems) {
      const incoming = receivedItems.find(r => r.id === poItem.id || r.inventory_id === poItem.inventory_id);
      const receivedQty = Number(incoming?.received_qty ?? 0);
      const shortageQty = Math.max(0, poItem.quantity - receivedQty);
      const shortageReason = incoming?.shortage_reason || null;
      const conditionNotes = incoming?.condition_notes || null;

      let itemStatus = 'pending';
      if (receivedQty >= poItem.quantity) itemStatus = 'full';
      else if (receivedQty > 0) itemStatus = 'partial';
      else if (receivedQty === 0 && incoming) itemStatus = 'missing';

      if (receivedQty < poItem.quantity) allFull = false;
      if (shortageQty > 0) anyShortage = true;

      if (receivedQty > 0) {
        const [inv] = await query('SELECT * FROM inventory WHERE id=?', [poItem.inventory_id]);
        if (inv) {
          const newQty = (inv.quantity || 0) + receivedQty;
          await run(`UPDATE inventory SET quantity=?, updated_at=datetime('now') WHERE id=?`,
            [newQty, poItem.inventory_id]);

          await run(`
            INSERT INTO inventory_movements
              (inventory_id, movement_type, quantity, reference, user_id, notes, created_at)
            VALUES (?, 'purchase', ?, ?, ?, ?, datetime('now'))
          `, [
            poItem.inventory_id, receivedQty,
            `PO-${id}`,
            req.user?.id,
            `Received from PO #${id}${shortageQty > 0 ? ` (ordered ${poItem.quantity}, received ${receivedQty})` : ''}`,
          ]);

          await run(`
            INSERT INTO goods_receive_log
              (purchase_order_id, inventory_id, item_name, ordered_qty, received_qty,
               shortage_qty, unit_cost, total_cost, shortage_reason, condition_notes, received_by, received_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
          `, [
            id, poItem.inventory_id, inv.name,
            poItem.quantity, receivedQty, shortageQty,
            poItem.unit_price, receivedQty * poItem.unit_price,
            shortageReason, conditionNotes, req.user?.id,
          ]);

          totalReceivedValue += receivedQty * poItem.unit_price;
        }
      }

      await run(`
        UPDATE purchase_order_items SET
          received_qty=?, shortage_qty=?, shortage_reason=?,
          item_notes=COALESCE(?,item_notes), receive_status=?
        WHERE id=?
      `, [receivedQty, shortageQty, shortageReason, conditionNotes, itemStatus, poItem.id]);
    }

    const overallStatus   = allFull ? 'received' : anyShortage ? 'partial' : 'pending';
    const receiveStatus   = allFull ? 'complete'  : 'partial';

    await run(`
      UPDATE purchase_orders SET
        status=?, receive_status=?, received_amount=?,
        delivery_comments=?, received_at=datetime('now')
      WHERE id=?
    `, [overallStatus, receiveStatus, totalReceivedValue, delivery_comments || null, id]);

    if (anyShortage) {
      await run(`INSERT INTO notifications (type, message, for_roles, created_at) VALUES (?,?,?,datetime('now'))`, [
        'stock_shortage',
        `⚠️ PO #${id}: Goods received with shortages. Check purchase order for details.`,
        'admin,management',
      ]);
    }

    const [updated] = await query('SELECT * FROM purchase_orders WHERE id=?', [id]);
    const itemsResult = await query(`
      SELECT poi.*, i.name AS item_name, i.unit
        FROM purchase_order_items poi JOIN inventory i ON i.id=poi.inventory_id
       WHERE poi.purchase_order_id=?
    `, [id]);

    const receiveLog = await query(`
      SELECT grl.*, u.name AS received_by_name
        FROM goods_receive_log grl LEFT JOIN users u ON u.id=grl.received_by
       WHERE grl.purchase_order_id=?
       ORDER BY grl.received_at DESC
    `, [id]);

    res.json({ success: true, order: updated, items: itemsResult, receiveLog, totalReceivedValue });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getPurchaseOrderReceiveLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await query(`
      SELECT grl.*, u.name AS received_by_name
        FROM goods_receive_log grl
        LEFT JOIN users u ON u.id=grl.received_by
       WHERE grl.purchase_order_id=?
       ORDER BY grl.received_at DESC
    `, [id]);
    res.json(log);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ==================== PROMOTIONS ====================
const getPromotions = async (req, res) => {
  try {
    const promotions = await query("SELECT * FROM promotions ORDER BY active DESC,name");
    const happyHour = await query("SELECT * FROM happy_hour_schedules WHERE active=1 LIMIT 1");
    res.json({ promotions, happyHour: happyHour[0]||null });
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, value, active, start_time, end_time, description } = req.body;
    await run("UPDATE promotions SET name=?,type=?,value=?,active=?,start_time=?,end_time=?,description=? WHERE id=?", [name, type, value, active?1:0, start_time, end_time, description, id]);
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

const createPromotion = async (req, res) => {
  try {
    const { name, type, value, active=1, start_time, end_time, description } = req.body;
    const { lastId } = await run("INSERT INTO promotions (name,type,value,active,start_time,end_time,description) VALUES (?,?,?,?,?,?,?)", [name, type, value, active?1:0, start_time, end_time, description]);
    const p = await query("SELECT * FROM promotions WHERE id=?", [lastId]);
    res.json(p[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

// ==================== ROOMS ====================
const getRooms = async (req, res) => {
  try {
    const rooms = await query("SELECT * FROM rooms ORDER BY number");
    res.json(rooms);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, guest_name, guest_phone, check_in, check_out, deposit_paid, notes, rate_per_night } = req.body;
    await run("UPDATE rooms SET status=?,guest_name=?,guest_phone=?,check_in=?,check_out=?,deposit_paid=?,notes=?,rate_per_night=? WHERE id=?",
      [status, guest_name||null, guest_phone||null, check_in||null, check_out||null, deposit_paid||0, notes||null, rate_per_night, id]);
    res.json({success:true});
  } catch(err) { res.status(500).json({error:err.message}); }
};

// ==================== BUFFET ====================
const getBuffetBookings = async (req, res) => {
  try {
    const bookings = await query("SELECT * FROM buffet_bookings ORDER BY date DESC");
    res.json(bookings);
  } catch(err) { res.status(500).json({error:err.message}); }
};

const createBuffetBooking = async (req, res) => {
  try {
    const { guest_name, guest_phone, date, pax, rate_per_pax, deposit_paid, notes } = req.body;
    const total = pax * rate_per_pax;
    const { lastId } = await run("INSERT INTO buffet_bookings (guest_name,guest_phone,date,pax,rate_per_pax,deposit_paid,total_amount,notes) VALUES (?,?,?,?,?,?,?,?)",
      [guest_name, guest_phone, date, pax, rate_per_pax, deposit_paid||0, total, notes]);
    const b = await query("SELECT * FROM buffet_bookings WHERE id=?", [lastId]);
    res.json(b[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
};

module.exports = {
  getDashboardStats, 
  getSalesReport, 
  getInventoryReport, 
  getStockReport,
  getWaiterCommissions, 
  getPurchaseReport, 
  getFastSlowItems,
  updateInventory, 
  addInventoryItem,
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  getNotifications, 
  markNotificationRead,
  getShifts, 
  openShift, 
  closeShift,
  initiateMpesa,
  mpesaCallback,  
  getSettings, 
  updateEmailSettings, 
  updateMpesaSettings,
  getSuppliers, 
  createSupplier, 
  updateSupplier,
  getPurchaseOrders, 
  createPurchaseOrder, 
  receivePurchaseOrder, 
  getPurchaseOrderReceiveLog,
  getPromotions, 
  updatePromotion, 
  createPromotion,
  getRooms, 
  updateRoom,
  getBuffetBookings, 
  createBuffetBooking,
  getRequisitions, 
  createRequisition, 
  updateRequisitionStatus
};