// controllers/reservationController.js — Sai Lounge POS
// Handles: Room Reservations, Waiter Shift Hours, Commission Log
const { query, run, runTransaction } = require('../models/database');

// ═══════════════════════════════════════════════════════════════════════════
// ROOM RESERVATIONS
// ═══════════════════════════════════════════════════════════════════════════

const getReservations = async (req, res) => {
  try {
    const { status, from, to, room_id } = req.query;
    let conditions = ['1=1'];
    const params = [];

    if (status && status !== 'all') { conditions.push('rv.status = ?'); params.push(status); }
    if (room_id) { conditions.push('rv.room_id = ?'); params.push(room_id); }
    if (from) { conditions.push('rv.check_in_date >= ?'); params.push(from); }
    if (to)   { conditions.push('rv.check_in_date <= ?'); params.push(to); }

    const reservations = await query(`
      SELECT rv.*,
             r.number  AS room_number,
             r.name    AS room_name,
             r.type    AS room_type,
             r.status  AS room_current_status,
             u.name    AS created_by_name
        FROM room_reservations rv
        LEFT JOIN rooms        r ON r.id = rv.room_id
        LEFT JOIN users        u ON u.id = rv.created_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY rv.check_in_date ASC, rv.created_at DESC
    `, params);

    // Summary counts
    const summary = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='confirmed'   THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN status='checked_in'  THEN 1 ELSE 0 END) AS checked_in,
        SUM(CASE WHEN status='checked_out' THEN 1 ELSE 0 END) AS checked_out,
        SUM(CASE WHEN status='cancelled'   THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status='no_show'     THEN 1 ELSE 0 END) AS no_show,
        SUM(CASE WHEN check_in_date = date('now') AND status='confirmed' THEN 1 ELSE 0 END) AS arriving_today,
        SUM(CASE WHEN check_out_date = date('now') AND status='checked_in' THEN 1 ELSE 0 END) AS departing_today
      FROM room_reservations
    `);

    // Today's arrivals for quick view
    const todayArrivals = await query(`
      SELECT rv.*, r.number AS room_number, r.name AS room_name
        FROM room_reservations rv
        LEFT JOIN rooms r ON r.id = rv.room_id
       WHERE rv.check_in_date = date('now') AND rv.status = 'confirmed'
       ORDER BY rv.check_in_date ASC
    `);

    res.json({ reservations, summary: summary[0] || {}, todayArrivals });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const [rv] = await query(`
      SELECT rv.*, r.number AS room_number, r.name AS room_name,
             r.type AS room_type, r.rate_per_night,
             u.name AS created_by_name
        FROM room_reservations rv
        LEFT JOIN rooms r ON r.id = rv.room_id
        LEFT JOIN users u ON u.id = rv.created_by
       WHERE rv.id = ?
    `, [id]);
    if (!rv) return res.status(404).json({ error: 'Reservation not found' });
    res.json(rv);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const createReservation = async (req, res) => {
  try {
    const {
      room_id, guest_name, guest_phone, guest_email, guest_id_number,
      check_in_date, check_out_date, adults = 1, children = 0,
      deposit_required = 0, deposit_paid = 0, special_requests, source = 'walk_in', notes,
    } = req.body;

    if (!room_id || !guest_name || !check_in_date || !check_out_date) {
      return res.status(400).json({ error: 'room_id, guest_name, check_in_date and check_out_date are required' });
    }

    // Check room exists and is available for those dates
    const [room] = await query('SELECT * FROM rooms WHERE id = ? AND status != ?', [room_id, 'deleted']);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Check for overlapping confirmed/checked_in reservations
    const conflicts = await query(`
      SELECT id FROM room_reservations
       WHERE room_id = ?
         AND status IN ('confirmed','checked_in')
         AND NOT (check_out_date <= ? OR check_in_date >= ?)
    `, [room_id, check_in_date, check_out_date]);
    if (conflicts.length) {
      return res.status(409).json({ error: 'Room already has a reservation for those dates' });
    }

    const nights = Math.max(1, Math.ceil(
      (new Date(check_out_date) - new Date(check_in_date)) / 86400000
    ));
    const room_rate      = room.rate_per_night || 0;
    const estimated_total = room_rate * nights;

    const { lastId } = await run(`
      INSERT INTO room_reservations
        (room_id, guest_name, guest_phone, guest_email, guest_id_number,
         check_in_date, check_out_date, nights, room_rate, estimated_total,
         deposit_required, deposit_paid, adults, children,
         special_requests, source, notes, created_by, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'confirmed')
    `, [
      room_id, guest_name, guest_phone || null, guest_email || null, guest_id_number || null,
      check_in_date, check_out_date, nights, room_rate, estimated_total,
      deposit_required, deposit_paid, adults, children,
      special_requests || null, source, notes || null, req.user?.id,
    ]);

    // Notify management
    await run(`INSERT INTO notifications (type, message, for_roles) VALUES (?,?,?)`, [
      'reservation',
      `New reservation: ${guest_name} → Room ${room.number} (${check_in_date} to ${check_out_date})`,
      'admin,management',
    ]);

    const [created] = await query(`
      SELECT rv.*, r.number AS room_number, r.name AS room_name
        FROM room_reservations rv LEFT JOIN rooms r ON r.id=rv.room_id
       WHERE rv.id=?
    `, [lastId]);
    res.json(created);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      guest_name, guest_phone, guest_email, guest_id_number,
      check_in_date, check_out_date, adults, children,
      deposit_required, deposit_paid, special_requests, source, notes, status,
      cancellation_reason,
    } = req.body;

    const [existing] = await query('SELECT * FROM room_reservations WHERE id=?', [id]);
    if (!existing) return res.status(404).json({ error: 'Reservation not found' });

    const nights = Math.max(1, Math.ceil(
      (new Date(check_out_date || existing.check_out_date) - new Date(check_in_date || existing.check_in_date)) / 86400000
    ));
    const estimated_total = (existing.room_rate || 0) * nights;

    await run(`
      UPDATE room_reservations SET
        guest_name=?, guest_phone=?, guest_email=?, guest_id_number=?,
        check_in_date=?, check_out_date=?, nights=?, estimated_total=?,
        adults=?, children=?, deposit_required=?, deposit_paid=?,
        special_requests=?, source=?, notes=?, status=?,
        cancellation_reason=?, updated_at=datetime('now')
      WHERE id=?
    `, [
      guest_name || existing.guest_name,
      guest_phone ?? existing.guest_phone,
      guest_email ?? existing.guest_email,
      guest_id_number ?? existing.guest_id_number,
      check_in_date || existing.check_in_date,
      check_out_date || existing.check_out_date,
      nights, estimated_total,
      adults ?? existing.adults, children ?? existing.children,
      deposit_required ?? existing.deposit_required,
      deposit_paid ?? existing.deposit_paid,
      special_requests ?? existing.special_requests,
      source || existing.source,
      notes ?? existing.notes,
      status || existing.status,
      cancellation_reason ?? existing.cancellation_reason,
      id,
    ]);

    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Convert reservation → actual check-in (updates room status)
const checkInFromReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const [rv] = await query('SELECT * FROM room_reservations WHERE id=?', [id]);
    if (!rv) return res.status(404).json({ error: 'Reservation not found' });
    if (rv.status === 'checked_in') return res.status(400).json({ error: 'Already checked in' });

    const today = new Date().toISOString().split('T')[0];

    await runTransaction([
      {
        sql: `UPDATE room_reservations SET status='checked_in', updated_at=datetime('now') WHERE id=?`,
        params: [id],
      },
      {
        sql: `UPDATE rooms SET
                status='occupied', guest_name=?, guest_phone=?, guest_email=?,
                guest_id_number=?, check_in=?, check_out=?, deposit_paid=?, notes=?
              WHERE id=?`,
        params: [
          rv.guest_name, rv.guest_phone, rv.guest_email, rv.guest_id_number,
          today, rv.check_out_date, rv.deposit_paid, rv.notes || null, rv.room_id,
        ],
      },
    ]);

    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getRoomAvailability = async (req, res) => {
  try {
    const { check_in, check_out, type } = req.query;
    if (!check_in || !check_out) return res.status(400).json({ error: 'check_in and check_out required' });

    // Get rooms that have conflicting reservations
    const busyRoomIds = await query(`
      SELECT DISTINCT room_id FROM room_reservations
       WHERE status IN ('confirmed','checked_in')
         AND NOT (check_out_date <= ? OR check_in_date >= ?)
    `, [check_in, check_out]);

    const busyIds = busyRoomIds.map(r => r.room_id);

    let sql = `SELECT * FROM rooms WHERE status != 'deleted'`;
    const params = [];
    if (type) { sql += ' AND type = ?'; params.push(type); }

    const allRooms = await query(sql, params);
    const nights = Math.max(1, Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000));

    const rooms = allRooms.map(r => ({
      ...r,
      available: !busyIds.includes(r.id) && r.status === 'available',
      nights,
      estimated_total: (r.rate_per_night || 0) * nights,
    }));

    res.json({ rooms, nights });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════════════════════
// WAITER SHIFT HOURS
// ═══════════════════════════════════════════════════════════════════════════

const getWaiterShifts = async (req, res) => {
  try {
    const { from, to, user_id, status } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || today;
    const toDate   = to   || today;

    let conditions = [`date(ws.date) BETWEEN ? AND ?`];
    const params = [fromDate, toDate];

    if (user_id) { conditions.push('ws.user_id = ?'); params.push(user_id); }
    if (status)  { conditions.push('ws.status = ?');  params.push(status); }

    const shifts = await query(`
      SELECT ws.*,
             u.name AS waiter_name,
             u.role AS waiter_role,
             u.commission_rate,
             ap.name AS approved_by_name
        FROM waiter_shifts ws
        JOIN  users u  ON u.id  = ws.user_id
        LEFT JOIN users ap ON ap.id = ws.overtime_approved_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY ws.clock_in DESC
    `, params);

    // Summary
    const summary = await query(`
      SELECT
        COUNT(*)                    AS total_shifts,
        COALESCE(SUM(actual_hours),0)   AS total_hours,
        COALESCE(SUM(overtime_hours),0) AS total_overtime,
        COUNT(CASE WHEN overtime_hours > 0 THEN 1 END) AS overtime_shifts,
        COUNT(CASE WHEN status='active' THEN 1 END) AS currently_active
      FROM waiter_shifts
      WHERE date(date) BETWEEN ? AND ?
        ${user_id ? 'AND user_id = ?' : ''}
    `, user_id ? [fromDate, toDate, user_id] : [fromDate, toDate]);

    res.json({ shifts, summary: summary[0] || {}, from: fromDate, to: toDate });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const clockIn = async (req, res) => {
  try {
    const { user_id, notes } = req.body;
    const uid = user_id || req.user?.id;

    // Check already clocked in today
    const active = await query(`
      SELECT * FROM waiter_shifts
       WHERE user_id=? AND status='active'
    `, [uid]);
    if (active.length) return res.status(400).json({ error: 'Already clocked in', shift: active[0] });

    const { lastId } = await run(`
      INSERT INTO waiter_shifts (user_id, clock_in, scheduled_hours, date, status, notes)
      VALUES (?, datetime('now'), 8, date('now'), 'active', ?)
    `, [uid, notes || null]);

    const [shift] = await query(`
      SELECT ws.*, u.name AS waiter_name
        FROM waiter_shifts ws JOIN users u ON u.id=ws.user_id
       WHERE ws.id=?
    `, [lastId]);

    if (req.io) req.io.emit('waiter:clocked_in', shift);
    res.json(shift);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const clockOut = async (req, res) => {
  try {
    const { shift_id, notes, break_minutes = 0 } = req.body;

    const [shift] = await query('SELECT * FROM waiter_shifts WHERE id=?', [shift_id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.status === 'completed') return res.status(400).json({ error: 'Shift already completed' });

    const clockIn   = new Date(shift.clock_in);
    const clockOut  = new Date();
    const rawHours  = (clockOut - clockIn) / 3600000;
    const breakH    = (Number(break_minutes) || 0) / 60;
    const actualH   = Math.max(0, rawHours - breakH);
    const scheduled = shift.scheduled_hours || 8;
    const overtime  = Math.max(0, actualH - scheduled);

    await run(`
      UPDATE waiter_shifts SET
        clock_out       = datetime('now'),
        actual_hours    = ?,
        overtime_hours  = ?,
        break_minutes   = ?,
        status          = 'completed',
        notes           = COALESCE(?, notes),
        overtime_notes  = CASE WHEN ? > 0 THEN 'Pending approval' ELSE NULL END
      WHERE id=?
    `, [
      Math.round(actualH * 100) / 100,
      Math.round(overtime * 100) / 100,
      Number(break_minutes) || 0,
      notes || null,
      overtime,
      shift_id,
    ]);

    if (overtime > 0) {
      await run(`INSERT INTO notifications (type, message, for_roles) VALUES (?,?,?)`, [
        'overtime',
        `Overtime: ${(await query('SELECT name FROM users WHERE id=?', [shift.user_id]))[0]?.name} worked ${Math.round(overtime * 60)} extra minutes`,
        'admin,management',
      ]);
    }

    const [updated] = await query(`
      SELECT ws.*, u.name AS waiter_name
        FROM waiter_shifts ws JOIN users u ON u.id=ws.user_id
       WHERE ws.id=?
    `, [shift_id]);

    if (req.io) req.io.emit('waiter:clocked_out', updated);
    res.json(updated);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const approveOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body;
    await run(`
      UPDATE waiter_shifts SET
        overtime_approved = ?,
        overtime_approved_by = ?,
        overtime_notes = ?
      WHERE id=?
    `, [approved ? 1 : 0, req.user?.id, notes || null, id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

const getActiveWaiters = async (req, res) => {
  try {
    const active = await query(`
      SELECT ws.*, u.name AS waiter_name, u.role,
             ROUND((julianday('now') - julianday(ws.clock_in)) * 24, 2) AS hours_so_far
        FROM waiter_shifts ws
        JOIN users u ON u.id = ws.user_id
       WHERE ws.status = 'active'
       ORDER BY ws.clock_in ASC
    `);
    res.json(active);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════════════════════
// COMMISSION LOG
// ═══════════════════════════════════════════════════════════════════════════

const getCommissionLog = async (req, res) => {
  try {
    const { from, to, waiter_id, paid } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || today;
    const toDate   = to   || today;

    let conditions = [`date(cl.created_at) BETWEEN ? AND ?`];
    const params = [fromDate, toDate];
    if (waiter_id) { conditions.push('cl.waiter_id = ?'); params.push(waiter_id); }
    if (paid !== undefined) { conditions.push('cl.paid = ?'); params.push(paid === 'true' ? 1 : 0); }

    const logs = await query(`
      SELECT cl.*, u.name AS waiter_name, mi.name AS item_name_fresh
        FROM commission_log cl
        JOIN  users u  ON u.id  = cl.waiter_id
        LEFT JOIN menu_items mi ON mi.id = cl.menu_item_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cl.created_at DESC
    `, params);

    // Summary per waiter
    const summary = await query(`
      SELECT cl.waiter_id, u.name AS waiter_name,
             COALESCE(SUM(cl.commission_amount),0)  AS total_commission,
             COALESCE(SUM(CASE WHEN cl.paid=0 THEN cl.commission_amount ELSE 0 END),0) AS unpaid_commission,
             COALESCE(SUM(CASE WHEN cl.paid=1 THEN cl.commission_amount ELSE 0 END),0) AS paid_commission,
             COUNT(*) AS transactions
        FROM commission_log cl
        JOIN users u ON u.id=cl.waiter_id
       WHERE date(cl.created_at) BETWEEN ? AND ?
       GROUP BY cl.waiter_id
    `, [fromDate, toDate]);

    res.json({ logs, summary, from: fromDate, to: toDate });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Mark commissions as paid (bulk by waiter or individual)
const payCommission = async (req, res) => {
  try {
    const { waiter_id, log_ids, from, to } = req.body;

    if (log_ids && log_ids.length) {
      // Pay specific log entries
      for (const logId of log_ids) {
        await run(`UPDATE commission_log SET paid=1, paid_at=datetime('now'), paid_by=? WHERE id=?`,
          [req.user?.id, logId]);
      }
    } else if (waiter_id) {
      const fromClause = from ? `AND date(created_at) >= '${from.replace(/'/g,"''")}'` : '';
      const toClause   = to   ? `AND date(created_at) <= '${to.replace(/'/g,"''")}'`   : '';
      await run(
        `UPDATE commission_log SET paid=1, paid_at=datetime('now'), paid_by=?
         WHERE waiter_id=? AND paid=0 ${fromClause} ${toClause}`,
        [req.user?.id, waiter_id]
      );
    } else {
      return res.status(400).json({ error: 'Provide waiter_id or log_ids' });
    }

    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

module.exports = {
  // Reservations
  getReservations, getReservation, createReservation, updateReservation,
  checkInFromReservation, getRoomAvailability,
  // Waiter shifts
  getWaiterShifts, clockIn, clockOut, approveOvertime, getActiveWaiters,
  // Commission
  getCommissionLog, payCommission,
};
