const { query, run, runTransaction } = require('../models/database');

const getUnpaidBills = async (req, res) => {
  try {
    const bills = await query(`SELECT b.*, rt.number as table_number, u.name as waiter_name FROM bills b LEFT JOIN restaurant_tables rt ON rt.id=b.table_id LEFT JOIN orders o ON o.id=b.order_id LEFT JOIN users u ON u.id=o.waiter_id WHERE b.status='unpaid' ORDER BY b.created_at DESC`);
    res.json(bills);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getBillDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const bills = await query(`SELECT b.*, rt.number as table_number, u.name as waiter_name FROM bills b LEFT JOIN restaurant_tables rt ON rt.id=b.table_id LEFT JOIN orders o ON o.id=b.order_id LEFT JOIN users u ON u.id=o.waiter_id WHERE b.id=?`, [id]);
    if (!bills.length) return res.status(404).json({ error: 'Not found' });
    
    const items = await query(`
      SELECT oi.*, mi.name as item_name 
      FROM order_items oi 
      JOIN menu_items mi ON mi.id=oi.menu_item_id 
      WHERE oi.order_id=?
    `, [bills[0].order_id]);
    
    // Combine items with same name for display
    const combinedItems = [];
    items.forEach(item => {
      const existing = combinedItems.find(i => i.item_name === item.item_name);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        combinedItems.push({ ...item });
      }
    });
    
    // Calculate correct total from combined items
    const calculatedTotal = combinedItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
    
    // If there's a mismatch, update the bill
    if (Math.abs(calculatedTotal - bills[0].total) > 0.01) {
      console.log(`Fixing bill ${id}: DB total=${bills[0].total}, Calculated=${calculatedTotal}`);
      await run("UPDATE bills SET subtotal = ?, total = ? WHERE id = ?", [calculatedTotal, calculatedTotal, id]);
      bills[0].total = calculatedTotal;
      bills[0].subtotal = calculatedTotal;
    }
    
    res.json({ ...bills[0], items: combinedItems, calculated_total: calculatedTotal });
  } catch(err) { 
    console.error('Get bill details error:', err);
    res.status(500).json({ error: err.message }); 
  }
};

const createBill = async (req, res) => {
  try {
    const { order_id, table_id } = req.body;
    const existing = await query("SELECT * FROM bills WHERE order_id=? AND status='unpaid'", [order_id]);
    if (existing.length) return res.json(existing[0]);
    const items = await query("SELECT oi.*, mi.price FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=?", [order_id]);
    const subtotal = items.reduce((s,i)=>s+(i.quantity*i.unit_price),0);
    const { lastId } = await run("INSERT INTO bills (order_id, table_id, subtotal, total, status) VALUES (?,?,?,?,'unpaid')", [order_id, table_id, subtotal, subtotal]);
    if (table_id) await run("UPDATE restaurant_tables SET status='billing' WHERE id=?", [table_id]);
    const bill = await query("SELECT * FROM bills WHERE id=?", [lastId]);
    if (req.io) req.io.emit('bill:created', bill[0]);
    res.json(bill[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Helper function to deduct inventory for an order
// Helper function to deduct inventory for an order
async function deductInventoryForOrder(orderId, cashierId, notes) {
  try {
    console.log(`📦 Starting inventory deduction for order ${orderId}...`);
    
    const orderItems = await query(`
      SELECT oi.*, mi.name as item_name, mi.id as menu_item_id, mi.price
      FROM order_items oi 
      JOIN menu_items mi ON mi.id = oi.menu_item_id 
      WHERE oi.order_id = ?
    `, [orderId]);
    
    if (orderItems.length === 0) {
      console.log(`No items found in order ${orderId}`);
      return 0;
    }
    
    let totalDeducted = 0;
    
    for (const oi of orderItems) {
      const ingredients = await query(`
        SELECT * FROM menu_item_ingredients WHERE menu_item_id = ?
      `, [oi.menu_item_id]);
      
      if (ingredients.length === 0) {
        console.log(`⚠️ No recipe found for item ${oi.item_name} (ID: ${oi.menu_item_id}), skipping`);
        continue;
      }
      
      for (const ing of ingredients) {
        const used = ing.quantity_used * oi.quantity;
        
        const inventory = await query("SELECT * FROM inventory WHERE id = ?", [ing.inventory_id]);
        if (!inventory.length) continue;
        
        const oldQuantity = inventory[0].quantity;
        const newQuantity = Math.max(0, oldQuantity - used);
        
        await run("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?", 
          [newQuantity, ing.inventory_id]);
        
        await run(`INSERT INTO inventory_movements 
          (inventory_id, movement_type, quantity, user_id, notes, created_at) 
          VALUES (?, 'usage', ?, ?, ?, datetime('now'))`, 
          [ing.inventory_id, used, cashierId, notes || `Order #${orderId} - ${oi.item_name}`]);
        
        totalDeducted += used;
        
        if (newQuantity <= inventory[0].reorder_level && newQuantity > 0) {
          await run(`INSERT INTO notifications (type, message, for_roles, created_at) 
            VALUES (?, ?, ?, datetime('now'))`, 
            ['low_stock', `⚠️ Low stock: ${inventory[0].name} has only ${newQuantity} ${inventory[0].unit} left`, 'admin,management']);
        } else if (newQuantity === 0 && oldQuantity > 0) {
          await run(`INSERT INTO notifications (type, message, for_roles, created_at) 
            VALUES (?, ?, ?, datetime('now'))`, 
            ['out_of_stock', `❌ OUT OF STOCK: ${inventory[0].name}`, 'admin,management']);
        }
      }
    }
    
    console.log(`✅ Total inventory deducted: ${totalDeducted} units`);
    return totalDeducted;
  } catch(err) {
    console.error('❌ Error deducting inventory:', err);
    return 0;
  }
}

// ==================== PROCESS PAYMENT ====================
const processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payment_method,
      cash_amount   = 0,
      mpesa_amount  = 0,
      mpesa_ref     = '',
      card_amount   = 0,
      cashier_id,
      discount      = 0,
    } = req.body;

    // ── 1. Load the bill ────────────────────────────────────────────────────
    const [bill] = await query('SELECT * FROM bills WHERE id = ?', [id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.status === 'paid') return res.status(400).json({ error: 'Bill is already paid' });
    const orderItems = await query(
        `SELECT oi.quantity, oi.unit_price, mi.price as menu_price
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = ?`,
        [bill.order_id]
);
    if (!orderItems.length) {
      return res.status(400).json({ error: 'No items found on this bill' });
    }

    const subtotal   = orderItems.reduce((s, i) => s + i.quantity * (i.unit_price || i.menu_price || 0), 0);
    const discountAmt = Math.min(Number(discount) || 0, subtotal);
    const finalTotal  = Math.max(0, subtotal - discountAmt);

    // ── 3. Determine how much was actually paid ─────────────────────────────
    const cashPaid  = Number(cash_amount)  || 0;
    const mpesaPaid = Number(mpesa_amount) || 0;
    const cardPaid  = Number(card_amount)  || 0;

    let amountPaid;
    if (payment_method === 'cash')  amountPaid = cashPaid;
    else if (payment_method === 'mpesa') amountPaid = mpesaPaid  || finalTotal;
    else if (payment_method === 'card')  amountPaid = cardPaid   || finalTotal;
    else if (payment_method === 'split') amountPaid = cashPaid + mpesaPaid + cardPaid;
    else return res.status(400).json({ error: `Unknown payment method: ${payment_method}` });

    // ── 4. Write everything in one atomic transaction ───────────────────────
    await runTransaction([
      // Mark bill paid
      {
        sql: `UPDATE bills SET
                status         = 'paid',
                payment_method = ?,
                cash_amount    = ?,
                mpesa_amount   = ?,
                mpesa_ref      = ?,
                card_amount    = ?,
                discount       = ?,
                cashier_id     = ?,
                paid_at        = datetime('now'),
                subtotal       = ?,
                total          = ?
              WHERE id = ?`,
        params: [
          payment_method,
          payment_method === 'cash'  ? cashPaid  : payment_method === 'split' ? cashPaid  : 0,
          payment_method === 'mpesa' ? mpesaPaid : payment_method === 'split' ? mpesaPaid : 0,
          mpesa_ref || null,
          payment_method === 'card'  ? cardPaid  : payment_method === 'split' ? cardPaid  : 0,
          discountAmt,
          cashier_id || null,
          subtotal,
          finalTotal,
          id,
        ],
      },
      // Mark order paid
      {
        sql: `UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?`,
        params: [bill.order_id],
      },
      // Free the table
      ...(bill.table_id
        ? [{ sql: `UPDATE restaurant_tables SET status = 'free' WHERE id = ?`, params: [bill.table_id] }]
        : []),
    ]);

    console.log(`✅ Bill ${id} paid — method: ${payment_method}, total: ${finalTotal}, paid: ${amountPaid}`);

    // ── 5. Log commissions for eligible items ───────────────────────────────
    try {
      const commissionItems = await query(`
        SELECT oi.*, mi.name AS item_name, mi.price, mi.commission_eligible,
               mi.commission_rate AS item_commission_rate, mi.commission_threshold,
               o.waiter_id, u.commission_rate AS waiter_rate
          FROM order_items oi
          JOIN menu_items mi ON mi.id=oi.menu_item_id
          JOIN orders o ON o.id=oi.order_id
          JOIN users u ON u.id=o.waiter_id
         WHERE oi.order_id=? AND o.waiter_id IS NOT NULL
      `, [bill.order_id]);

      for (const item of commissionItems) {
        // Eligible if: item has commission_eligible=1, OR item price >= commission_threshold
        const eligible = item.commission_eligible === 1 ||
          (item.commission_threshold > 0 && item.price >= item.commission_threshold);
        if (!eligible) continue;

        const commissionRate = item.item_commission_rate > 0
          ? item.item_commission_rate
          : (item.waiter_rate || 3);

        const saleAmount      = item.quantity * item.unit_price;
        const commissionAmt   = Math.round(saleAmount * (commissionRate / 100) * 100) / 100;

        await run(`
          INSERT INTO commission_log
            (waiter_id, order_id, bill_id, menu_item_id, item_name,
             item_price, quantity, sale_amount, commission_rate,
             commission_amount, is_expensive_item)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `, [
          item.waiter_id, bill.order_id, id,
          item.menu_item_id, item.item_name,
          item.price, item.quantity,
          saleAmount, commissionRate, commissionAmt,
          item.commission_eligible === 1 ? 1 : 0,
        ]);
      }
    } catch(commErr) {
      console.error('Commission log error (non-fatal):', commErr.message);
    }

    // ── 6. Deduct inventory (non-fatal if it fails) ─────────────────────────
    const deducted = await deductInventoryForOrder(
      bill.order_id,
      cashier_id,
      `Payment for Bill #${id}`
    );

    // ── 7. Emit socket events ───────────────────────────────────────────────
    if (req.io) {
      req.io.emit('bill:paid', { bill_id: id, table_id: bill.table_id });
    }

    res.json({
      success: true,
      total:    finalTotal,
      paid:     amountPaid,
      change:   Math.max(0, amountPaid - finalTotal),
      inventory_deducted: deducted,
    });

  } catch (err) {
    console.error('❌ Payment error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ==================== ADD ITEMS TO BILL ====================
const addItemsToBill = async (req, res) => {
  try {
    const { bill_id, order_id, table_id, items } = req.body;
    
    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items to add' });
    }
    
    let bill = null;
    
    if (bill_id) {
      const bills = await query("SELECT * FROM bills WHERE id = ? AND status = 'unpaid'", [bill_id]);
      if (bills.length) bill = bills[0];
    }
    
    if (!bill && order_id) {
      const bills = await query("SELECT * FROM bills WHERE order_id = ? AND status = 'unpaid'", [order_id]);
      if (bills.length) bill = bills[0];
    }
    
    if (!bill && table_id) {
      const bills = await query("SELECT * FROM bills WHERE table_id = ? AND status = 'unpaid'", [table_id]);
      if (bills.length) bill = bills[0];
    }
    
    if (!bill) {
      return res.status(404).json({ error: 'No active bill found for this table' });
    }
    
    // Add new items to order
    for (const item of items) {
      const existingItem = await query(
        "SELECT * FROM order_items WHERE order_id = ? AND menu_item_id = ? AND sent_at IS NULL",
        [bill.order_id, item.menu_item_id]
      );
      
      if (existingItem.length) {
        await run(
          "UPDATE order_items SET quantity = quantity + ? WHERE id = ?",
          [item.quantity, existingItem[0].id]
        );
      } else {
        await run(
          "INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?)",
          [bill.order_id, item.menu_item_id, item.quantity, item.unit_price, item.notes || null]
        );
      }
    }
    
    // Recalculate bill total
    const allItems = await query(`
      SELECT oi.*, mi.price as menu_price 
      FROM order_items oi 
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
    `, [bill.order_id]);
    
    let newTotal = 0;
    for (const item of allItems) {
      newTotal += item.quantity * (item.unit_price || item.menu_price || 0);
    }
    
    await run("UPDATE bills SET subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?", 
      [newTotal, newTotal, bill.id]);
    
    if (table_id) {
      await run("UPDATE restaurant_tables SET status = 'billing' WHERE id = ?", [table_id]);
    }
    
    res.json({ 
      success: true, 
      bill_id: bill.id,
      new_total: newTotal,
      items_added: items.length
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== REFRESH BILL BY ID (PUT /bills/:id/refresh) ====================
const refreshBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await query("SELECT * FROM bills WHERE id = ?", [id]);
    if (!bill.length) return res.status(404).json({ error: 'Bill not found' });

    const orderItems = await query(`
      SELECT oi.*, mi.price as menu_price 
      FROM order_items oi 
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
    `, [bill[0].order_id]);

    let correctTotal = 0;
    for (const item of orderItems) {
      correctTotal += item.quantity * (item.unit_price || item.menu_price || 0);
    }

    await run("UPDATE bills SET subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?",
      [correctTotal, correctTotal, id]);

    res.json({ success: true, old_total: bill[0].total, new_total: correctTotal });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
const refreshBillTotal = async (req, res) => {
  try {
    const { bill_id, order_id, table_id } = req.body;
    let billId = bill_id;
    
    if (order_id && !billId) {
      const bills = await query("SELECT id FROM bills WHERE order_id = ? AND status = 'unpaid'", [order_id]);
      if (bills.length) billId = bills[0].id;
    }
    
    if (!billId && table_id) {
      const bills = await query("SELECT id FROM bills WHERE table_id = ? AND status = 'unpaid'", [table_id]);
      if (bills.length) billId = bills[0].id;
    }
    
    if (!billId) return res.status(404).json({ error: 'Bill not found' });
    
    const bill = await query("SELECT * FROM bills WHERE id = ?", [billId]);
    if (!bill.length) return res.status(404).json({ error: 'Bill not found' });
    
    const orderItems = await query(`
      SELECT oi.*, mi.price as menu_price 
      FROM order_items oi 
      JOIN orders o ON o.id = oi.order_id 
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.id = ?
    `, [bill[0].order_id]);
    
    let correctTotal = 0;
    for (const item of orderItems) {
      const itemTotal = item.quantity * (item.unit_price || item.menu_price || 0);
      correctTotal += itemTotal;
    }
    
    await run("UPDATE bills SET subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?", 
      [correctTotal, correctTotal, billId]);
    
    if (table_id) {
      await run("UPDATE restaurant_tables SET status = 'billing' WHERE id = ?", [table_id]);
    }
    
    res.json({ 
      success: true, 
      old_total: bill[0].total, 
      new_total: correctTotal,
      message: `Bill total updated from ${bill[0].total} to ${correctTotal}`
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== MERGE BILL PREVIEW ====================
const mergeBillPreview = async (req, res) => {
  try {
    const { table_ids } = req.body;
    if (!table_ids || table_ids.length < 2) {
      return res.status(400).json({ error: 'At least 2 tables required for merge' });
    }

    const allItems = [];
    const tablesData = [];

    for (const tableId of table_ids) {
      const bill = await query(`
        SELECT b.*, rt.number as table_number 
        FROM bills b 
        JOIN restaurant_tables rt ON rt.id = b.table_id 
        WHERE b.table_id = ? AND b.status = 'unpaid'
      `, [tableId]);
      
      if (bill.length) {
        tablesData.push({ id: tableId, number: bill[0].table_number, total: bill[0].total });
        
        const items = await query(`
          SELECT oi.*, mi.name as item_name 
          FROM order_items oi 
          JOIN menu_items mi ON mi.id = oi.menu_item_id 
          WHERE oi.order_id = ?
        `, [bill[0].order_id]);
        
        for (const item of items) {
          const existing = allItems.find(i => i.name === item.item_name);
          if (existing) {
            existing.quantity += item.quantity;
            existing.total += (item.quantity * item.unit_price);
          } else {
            allItems.push({
              name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price
            });
          }
        }
      } else {
        tablesData.push({ id: tableId, number: '?', total: 0, hasNoBill: true });
      }
    }

    const totalAmount = allItems.reduce((sum, i) => sum + i.total, 0);
    
    res.json({
      tables: tablesData,
      items: allItems,
      total: totalAmount,
      bill_count: tablesData.filter(t => !t.hasNoBill).length
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== MERGE BILLS ====================
const mergeBills = async (req, res) => {
  try {
    const { table_ids } = req.body;
    if (!table_ids || table_ids.length < 2) {
      return res.status(400).json({ error: 'At least 2 tables required for merge' });
    }

    const allItems = [];
    let primaryBill = null;
    let primaryTableId = null;

    for (const tableId of table_ids) {
      const bill = await query(`
        SELECT b.*, rt.number as table_number 
        FROM bills b 
        JOIN restaurant_tables rt ON rt.id = b.table_id 
        WHERE b.table_id = ? AND b.status = 'unpaid'
      `, [tableId]);
      
      if (bill.length && bill[0].order_id) {
        if (!primaryBill) {
          primaryBill = bill[0];
          primaryTableId = tableId;
        }
        
        const items = await query(`
          SELECT oi.*, mi.name as item_name 
          FROM order_items oi 
          JOIN menu_items mi ON mi.id = oi.menu_item_id 
          WHERE oi.order_id = ?
        `, [bill[0].order_id]);
        
        for (const item of items) {
          const existing = allItems.find(i => i.menu_item_id === item.menu_item_id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            allItems.push({
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              notes: item.notes
            });
          }
        }
      }
    }

    if (!primaryBill) {
      return res.status(404).json({ error: 'No unpaid bills found for selected tables' });
    }

    // Update primary order with merged items
    await run("DELETE FROM order_items WHERE order_id = ?", [primaryBill.order_id]);
    
    for (const item of allItems) {
      await run(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes) 
        VALUES (?, ?, ?, ?, ?)
      `, [primaryBill.order_id, item.menu_item_id, item.quantity, item.unit_price, item.notes || null]);
    }

    const newSubtotal = allItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
    await run(`UPDATE bills SET subtotal = ?, total = ? WHERE id = ?`, [newSubtotal, newSubtotal, primaryBill.id]);

    for (const tableId of table_ids) {
      if (tableId !== primaryTableId) {
        const otherBill = await query("SELECT id, order_id FROM bills WHERE table_id = ? AND status = 'unpaid'", [tableId]);
        if (otherBill.length) {
          await run("UPDATE bills SET status = 'paid', paid_at = datetime('now'), payment_method = 'merged' WHERE id = ?", [otherBill[0].id]);
          await run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [otherBill[0].order_id]);
        }
        await run("UPDATE restaurant_tables SET status = 'free' WHERE id = ?", [tableId]);
      }
    }

    await run("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?", [primaryTableId]);

    if (req.io) {
      req.io.emit('bills:merged', { 
        primary_table_id: primaryTableId, 
        merged_tables: table_ids.filter(id => id !== primaryTableId),
        new_total: newSubtotal
      });
    }

    res.json({ 
      success: true, 
      message: `Successfully merged ${table_ids.length} tables`,
      bill_id: primaryBill.id,
      total: newSubtotal
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  getUnpaidBills, 
  getBillDetails, 
  createBill, 
  processPayment,
  mergeBillPreview,
  mergeBills,
  refreshBillTotal,
  refreshBillById,
  addItemsToBill
};