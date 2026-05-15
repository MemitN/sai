// controllers/roomController.js
const { query, run } = require('../models/database');

// Get all rooms
const getRooms = async (req, res) => {
  try {
    const rooms = await query("SELECT * FROM rooms ORDER BY number");
    res.json(rooms);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Create new room
const createRoom = async (req, res) => {
  try {
    const { number, name, type, rate_per_night, status = 'available' } = req.body;
    if (!number) return res.status(400).json({ error: 'Room number required' });
    
    const { lastId } = await run(
      "INSERT INTO rooms (number, name, type, rate_per_night, status) VALUES (?, ?, ?, ?, ?)",
      [number, name || null, type || 'standard', rate_per_night || 0, status]
    );
    const room = await query("SELECT * FROM rooms WHERE id = ?", [lastId]);
    res.json(room[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Update room
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { number, name, type, rate_per_night, status } = req.body;
    await run(
      "UPDATE rooms SET number=?, name=?, type=?, rate_per_night=?, status=? WHERE id=?",
      [number, name || null, type || 'standard', rate_per_night || 0, status, id]
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Delete room (soft delete - set inactive)
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    await run("UPDATE rooms SET status='deleted' WHERE id=?", [id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Create/Update table
const createTable = async (req, res) => {
  try {
    const { number, name, capacity, status = 'free' } = req.body;
    if (!number) return res.status(400).json({ error: 'Table number required' });
    
    const { lastId } = await run(
      "INSERT INTO restaurant_tables (number, name, capacity, status, type) VALUES (?, ?, ?, ?, 'table')",
      [number, name || null, capacity || 4, status]
    );
    const table = await query("SELECT * FROM restaurant_tables WHERE id = ?", [lastId]);
    res.json(table[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { number, name, capacity, status } = req.body;
    await run(
      "UPDATE restaurant_tables SET number=?, name=?, capacity=?, status=? WHERE id=?",
      [number, name || null, capacity || 4, status, id]
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    await run("DELETE FROM restaurant_tables WHERE id=?", [id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Guest check-in
const checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { guest_name, guest_phone, guest_email, guest_id_number, check_in, check_out, deposit_paid, notes } = req.body;
    
    await run(
      `UPDATE rooms SET 
        status='occupied', 
        guest_name=?, guest_phone=?, guest_email=?, guest_id_number=?, 
        check_in=?, check_out=?, deposit_paid=?, notes=?
      WHERE id=?`,
      [guest_name, guest_phone || null, guest_email || null, guest_id_number || null, 
       check_in || null, check_out || null, deposit_paid || 0, notes || null, id]
    );
    
    const room = await query("SELECT * FROM rooms WHERE id=?", [id]);
    if (req.io) req.io.emit('room:updated', room[0]);
    res.json(room[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Guest check-out and generate bill
const checkOut = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await query("SELECT * FROM rooms WHERE id=?", [id]);
    if (!room.length) return res.status(404).json({ error: 'Room not found' });
    
    const nights = room[0].check_in && room[0].check_out 
      ? Math.max(1, Math.ceil((new Date(room[0].check_out) - new Date(room[0].check_in)) / (1000 * 3600 * 24)))
      : 1;
    
    const room_charge = (room[0].rate_per_night || 0) * nights;
    
    // Generate bill number
    const billNumber = `RM-${Date.now()}-${room[0].id}`;
    
    const { lastId } = await run(
      `INSERT INTO room_bills 
        (room_id, bill_number, guest_name, guest_phone, check_in, check_out, nights, room_charge, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [room[0].id, billNumber, room[0].guest_name, room[0].guest_phone, 
       room[0].check_in, room[0].check_out, nights, room_charge, room_charge]
    );
    
    const bill = await query("SELECT * FROM room_bills WHERE id=?", [lastId]);
    res.json(bill[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Get room bills
const getRoomBills = async (req, res) => {
  try {
    const bills = await query(`
      SELECT rb.*, r.number as room_number, r.name as room_name 
      FROM room_bills rb 
      LEFT JOIN rooms r ON r.id = rb.room_id 
      ORDER BY rb.created_at DESC
    `);
    res.json(bills);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Get single room bill with extra charges
const getRoomBill = async (req, res) => {
  try {
    const { id } = req.params;
    const bills = await query(`
      SELECT rb.*, r.number as room_number, r.name as room_name 
      FROM room_bills rb 
      LEFT JOIN rooms r ON r.id = rb.room_id 
      WHERE rb.id = ?
    `, [id]);
    
    if (!bills.length) return res.status(404).json({ error: 'Bill not found' });
    
    const extraCharges = await query("SELECT * FROM room_extra_charges WHERE room_bill_id = ?", [id]);
    res.json({ ...bills[0], extra_charges_list: extraCharges });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Add extra charge to room bill
const addExtraCharge = async (req, res) => {
  try {
    const { billId } = req.params;
    const { description, amount } = req.body;
    
    if (!description || !amount) return res.status(400).json({ error: 'Description and amount required' });
    
    await run(
      "INSERT INTO room_extra_charges (room_bill_id, description, amount) VALUES (?, ?, ?)",
      [billId, description, amount]
    );
    
    // Update bill total
    await run(
      "UPDATE room_bills SET extra_charges = extra_charges + ?, total_amount = room_charge + extra_charges + ? WHERE id = ?",
      [amount, amount, billId]
    );
    
    const bill = await query("SELECT * FROM room_bills WHERE id=?", [billId]);
    res.json(bill[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Remove extra charge
const removeExtraCharge = async (req, res) => {
  try {
    const { chargeId } = req.params;
    const charge = await query("SELECT * FROM room_extra_charges WHERE id=?", [chargeId]);
    if (!charge.length) return res.status(404).json({ error: 'Charge not found' });
    
    await run("DELETE FROM room_extra_charges WHERE id=?", [chargeId]);
    await run(
      "UPDATE room_bills SET extra_charges = extra_charges - ?, total_amount = room_charge + extra_charges - ? WHERE id = ?",
      [charge[0].amount, charge[0].amount, charge[0].room_bill_id]
    );
    
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Process room bill payment
const processRoomPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, amount_paid, cashier_id } = req.body;
    
    const bill = await query("SELECT * FROM room_bills WHERE id=?", [id]);
    if (!bill.length) return res.status(404).json({ error: 'Bill not found' });
    
    const newPaid = (bill[0].paid_amount || 0) + amount_paid;
    const status = newPaid >= bill[0].total_amount ? 'paid' : 'partial';
    
    await run(
      `UPDATE room_bills SET 
        paid_amount = ?, status = ?, payment_method = ?, cashier_id = ?, paid_at = datetime('now')
       WHERE id = ?`,
      [newPaid, status, payment_method, cashier_id, id]
    );
    
    // If fully paid, free up the room
    if (status === 'paid') {
      await run(
        `UPDATE rooms SET status = 'available', guest_name = NULL, guest_phone = NULL, 
         guest_email = NULL, guest_id_number = NULL, check_in = NULL, check_out = NULL, 
         deposit_paid = 0, notes = NULL WHERE id = ?`,
        [bill[0].room_id]
      );
      if (req.io) req.io.emit('room:freed', bill[0].room_id);
    }
    
    const updated = await query("SELECT * FROM room_bills WHERE id=?", [id]);
    if (req.io) req.io.emit('room_bill:paid', updated[0]);
    res.json(updated[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Charge food/drink to room
const chargeToRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { order_id, bill_id, amount } = req.body;
    
    await run(
      "INSERT INTO room_orders (room_id, order_id, bill_id, amount) VALUES (?, ?, ?, ?)",
      [roomId, order_id, bill_id, amount]
    );
    
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

module.exports = {
  getRooms, createRoom, updateRoom, deleteRoom,
  createTable, updateTable, deleteTable,
  checkIn, checkOut,
  getRoomBills, getRoomBill, addExtraCharge, removeExtraCharge, processRoomPayment,
  chargeToRoom
};