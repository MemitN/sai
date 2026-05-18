const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../sai_lounge.db');
let db = null;

async function getDB() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDB() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// Helper function to safely add columns
async function addColumnIfNotExists(table, column, type) {
  try {
    const result = db.exec(`PRAGMA table_info(${table})`);
    const columns = result[0]?.values.map(col => col[1]) || [];
    
    if (!columns.includes(column)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`✓ Added column ${column} to ${table}`);
      return true;
    }
  } catch(e) {
    console.log(`⚠️ Could not add column ${column} to ${table}: ${e.message}`);
  }
  return false;
}

// ==================== TIMEZONE FIX FUNCTIONS ====================

// Get current Kenya time as SQLite compatible string (YYYY-MM-DD HH:MM:SS)
function getKenyaTime() {
  const now = new Date();
  // Kenya is UTC+3 year-round
  const kenyaTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return kenyaTime.toISOString().slice(0, 19).replace('T', ' ');
}

// Convert UTC stored time to Kenya time for display
function toKenyaTime(utcDateString) {
  if (!utcDateString) return null;
  const date = new Date(utcDateString);
  date.setHours(date.getHours() + 3);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Fix existing timezone data (convert UTC to Kenya time)
async function fixExistingTimezones(db) {
  console.log('🕐 Fixing existing timezone data (UTC → Kenya Time)...');
  
  try {
    // Fix waiter_shifts times
    db.run(`UPDATE waiter_shifts SET clock_in = datetime(clock_in, '+3 hours') WHERE clock_in IS NOT NULL`);
    db.run(`UPDATE waiter_shifts SET clock_out = datetime(clock_out, '+3 hours') WHERE clock_out IS NOT NULL`);
    db.run(`UPDATE waiter_shifts SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    
    // Fix orders times
    db.run(`UPDATE orders SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    db.run(`UPDATE orders SET updated_at = datetime(updated_at, '+3 hours') WHERE updated_at IS NOT NULL`);
    
    // Fix bills times
    db.run(`UPDATE bills SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    db.run(`UPDATE bills SET paid_at = datetime(paid_at, '+3 hours') WHERE paid_at IS NOT NULL`);
    db.run(`UPDATE bills SET updated_at = datetime(updated_at, '+3 hours') WHERE updated_at IS NOT NULL`);
    
    // Fix shifts times
    db.run(`UPDATE shifts SET opened_at = datetime(opened_at, '+3 hours') WHERE opened_at IS NOT NULL`);
    db.run(`UPDATE shifts SET closed_at = datetime(closed_at, '+3 hours') WHERE closed_at IS NOT NULL`);
    
    // Fix room_bills times
    db.run(`UPDATE room_bills SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    db.run(`UPDATE room_bills SET paid_at = datetime(paid_at, '+3 hours') WHERE paid_at IS NOT NULL`);
    
    // Fix rooms (check-in/out times)
    db.run(`UPDATE rooms SET check_in = datetime(check_in, '+3 hours') WHERE check_in IS NOT NULL`);
    db.run(`UPDATE rooms SET check_out = datetime(check_out, '+3 hours') WHERE check_out IS NOT NULL`);
    
    // Fix room_reservations
    db.run(`UPDATE room_reservations SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    db.run(`UPDATE room_reservations SET updated_at = datetime(updated_at, '+3 hours') WHERE updated_at IS NOT NULL`);
    
    // Fix commission_log
    db.run(`UPDATE commission_log SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    db.run(`UPDATE commission_log SET paid_at = datetime(paid_at, '+3 hours') WHERE paid_at IS NOT NULL`);
    
    // Fix customers
    db.run(`UPDATE customers SET created_at = datetime(created_at, '+3 hours') WHERE created_at IS NOT NULL`);
    db.run(`UPDATE customers SET updated_at = datetime(updated_at, '+3 hours') WHERE updated_at IS NOT NULL`);
    
    console.log('✅ Timezone fix applied - converted UTC to Kenya time (UTC+3)');
  } catch(e) {
    console.log('⚠️ Timezone fix error:', e.message);
  }
}

// Create triggers to automatically use Kenya time for new inserts
function createTimezoneTriggers(db) {
  console.log('🔧 Creating timezone triggers...');
  
  // Trigger for waiter_shifts
  try {
    db.run(`DROP TRIGGER IF EXISTS set_kenya_time_waiter_shifts`);
    db.run(`
      CREATE TRIGGER set_kenya_time_waiter_shifts
      AFTER INSERT ON waiter_shifts
      BEGIN
        UPDATE waiter_shifts 
        SET clock_in = datetime(NEW.clock_in, '+3 hours')
        WHERE id = NEW.id AND clock_in IS NOT NULL;
      END
    `);
  } catch(e) { console.log('Trigger waiter_shifts:', e.message); }
  
  // Trigger for orders
  try {
    db.run(`DROP TRIGGER IF EXISTS set_kenya_time_orders`);
    db.run(`
      CREATE TRIGGER set_kenya_time_orders
      AFTER INSERT ON orders
      BEGIN
        UPDATE orders 
        SET created_at = datetime(NEW.created_at, '+3 hours')
        WHERE id = NEW.id;
      END
    `);
  } catch(e) { console.log('Trigger orders:', e.message); }
  
  // Trigger for bills
  try {
    db.run(`DROP TRIGGER IF EXISTS set_kenya_time_bills`);
    db.run(`
      CREATE TRIGGER set_kenya_time_bills
      AFTER INSERT ON bills
      BEGIN
        UPDATE bills 
        SET created_at = datetime(NEW.created_at, '+3 hours')
        WHERE id = NEW.id;
      END
    `);
  } catch(e) { console.log('Trigger bills:', e.message); }
  
  console.log('✅ Timezone triggers created');
}

async function initializeDatabase() {
  const db = await getDB();

  // ==================== CORE TABLES ====================
  
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('waiter','cashier','kitchen','admin','management','bar_attendant')),
    active INTEGER DEFAULT 1,
    commission_rate REAL DEFAULT 3.0,
    email TEXT,
    phone TEXT,
    can_manage_rooms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS restaurant_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'free' CHECK(status IN ('free','occupied','billing')),
    capacity INTEGER DEFAULT 4,
    type TEXT DEFAULT 'table' CHECK(type IN ('table','room'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🍽️',
    department TEXT DEFAULT 'kitchen' CHECK(department IN ('kitchen','bar')),
    sort_order INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES menu_categories(id),
    name TEXT NOT NULL,
    price REAL NOT NULL,
    happy_hour_price REAL,
    description TEXT,
    available INTEGER DEFAULT 1,
    image_url TEXT,
    image_emoji TEXT DEFAULT '🍽️',
    unit TEXT DEFAULT 'serving'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER REFERENCES menu_items(id),
    inventory_id INTEGER REFERENCES inventory(id),
    quantity_used REAL NOT NULL DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER REFERENCES restaurant_tables(id),
    room_id INTEGER,
    waiter_id INTEGER REFERENCES users(id),
    order_type TEXT DEFAULT 'dine_in' CHECK(order_type IN ('dine_in','room','takeaway')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active','sent','held','paid','cancelled')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    menu_item_id INTEGER REFERENCES menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    notes TEXT,
    kitchen_status TEXT DEFAULT 'pending' CHECK(kitchen_status IN ('pending','preparing','done')),
    sent_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    table_id INTEGER REFERENCES restaurant_tables(id),
    customer_id INTEGER,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid','paid')),
    payment_method TEXT,
    cash_amount REAL DEFAULT 0,
    mpesa_amount REAL DEFAULT 0,
    mpesa_ref TEXT,
    card_amount REAL DEFAULT 0,
    cashier_id INTEGER REFERENCES users(id),
    paid_at TEXT,
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_redeemed INTEGER DEFAULT 0,
    loyalty_discount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT DEFAULT 'kitchen' CHECK(department IN ('kitchen','bar','store','equipment')),
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    reorder_level REAL DEFAULT 5,
    cost_price REAL DEFAULT 0,
    supplier_id INTEGER,
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER REFERENCES inventory(id),
    movement_type TEXT CHECK(movement_type IN ('purchase','usage','adjustment','requisition')),
    quantity REAL NOT NULL,
    reference TEXT,
    user_id INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    payment_terms TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    user_id INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','partial','received','cancelled')),
    receive_status TEXT DEFAULT 'pending' CHECK(receive_status IN ('pending','partial','complete')),
    total_amount REAL DEFAULT 0,
    received_amount REAL DEFAULT 0,
    notes TEXT,
    delivery_comments TEXT,
    expected_date TEXT,
    received_at TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    inventory_id INTEGER REFERENCES inventory(id),
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    received_qty REAL DEFAULT 0,
    shortage_qty REAL DEFAULT 0,
    shortage_reason TEXT,
    item_notes TEXT,
    receive_status TEXT DEFAULT 'pending' CHECK(receive_status IN ('pending','full','partial','missing'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    opened_at TEXT DEFAULT (datetime('now', '+3 hours')),
    closed_at TEXT,
    opening_float REAL DEFAULT 0,
    closing_cash REAL DEFAULT 0,
    closing_mpesa REAL DEFAULT 0,
    closing_card REAL DEFAULT 0,
    total_sales REAL DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','closed'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('percentage','fixed','happy_hour','buy2get1','bogo','buffet')),
    value REAL NOT NULL DEFAULT 0,
    description TEXT,
    active INTEGER DEFAULT 1,
    start_time TEXT,
    end_time TEXT,
    applicable_days TEXT DEFAULT '1,2,3,4,5,6,7',
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    name TEXT,
    type TEXT DEFAULT 'standard' CHECK(type IN ('standard','deluxe','suite')),
    rate_per_night REAL DEFAULT 0,
    status TEXT DEFAULT 'available' CHECK(status IN ('available','occupied','maintenance','checkout','deleted')),
    guest_name TEXT,
    guest_phone TEXT,
    guest_email TEXT,
    guest_id_number TEXT,
    check_in TEXT,
    check_out TEXT,
    deposit_paid REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS room_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER REFERENCES rooms(id),
    bill_number TEXT UNIQUE NOT NULL,
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    check_in TEXT,
    check_out TEXT,
    nights INTEGER DEFAULT 1,
    room_charge REAL DEFAULT 0,
    extra_charges REAL DEFAULT 0,
    extra_charges_details TEXT,
    total_amount REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','partial','paid')),
    payment_method TEXT,
    cashier_id INTEGER REFERENCES users(id),
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS room_extra_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_bill_id INTEGER REFERENCES room_bills(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS room_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER REFERENCES rooms(id),
    order_id INTEGER REFERENCES orders(id),
    bill_id INTEGER REFERENCES bills(id),
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','billed')),
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS buffet_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    date TEXT NOT NULL,
    pax INTEGER NOT NULL,
    rate_per_pax REAL NOT NULL,
    deposit_paid REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'booked' CHECK(status IN ('booked','confirmed','completed','cancelled')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    for_roles TEXT DEFAULT 'admin,management',
    read_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS happy_hour_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    days TEXT DEFAULT '1,2,3,4,5,6,7',
    discount_percent REAL NOT NULL DEFAULT 10,
    active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tots_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER REFERENCES inventory(id),
    user_id INTEGER REFERENCES users(id),
    tots_opened REAL DEFAULT 0,
    tots_sold REAL DEFAULT 0,
    tots_remaining REAL DEFAULT 0,
    date TEXT DEFAULT (date('now', '+3 hours')),
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS email_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_pass TEXT,
    from_email TEXT,
    from_name TEXT DEFAULT 'Sai Lounge POS',
    report_emails TEXT,
    send_eod_report INTEGER DEFAULT 1,
    daily_report_time TEXT DEFAULT '20:00',
    send_daily_report INTEGER DEFAULT 0,
    send_weekly_report INTEGER DEFAULT 0,
    send_monthly_report INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mpesa_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shortcode TEXT,
    passkey TEXT,
    consumer_key TEXT,
    consumer_secret TEXT,
    callback_url TEXT,
    environment TEXT DEFAULT 'sandbox' CHECK(environment IN ('sandbox','production')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mpesa_pending_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkout_request_id TEXT UNIQUE NOT NULL,
    bill_id INTEGER REFERENCES bills(id),
    amount REAL NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
    mpesa_receipt TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    completed_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS requisitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT NOT NULL CHECK(department IN ('kitchen','bar','store','equipment')),
    requested_by TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','issued','rejected')),
    approved_by INTEGER REFERENCES users(id),
    issued_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS requisition_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisition_id INTEGER REFERENCES requisitions(id),
    inventory_id INTEGER REFERENCES inventory(id),
    quantity REAL NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS room_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER REFERENCES rooms(id),
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    guest_email TEXT,
    guest_id_number TEXT,
    check_in_date TEXT NOT NULL,
    check_out_date TEXT NOT NULL,
    nights INTEGER DEFAULT 1,
    room_rate REAL DEFAULT 0,
    estimated_total REAL DEFAULT 0,
    deposit_required REAL DEFAULT 0,
    deposit_paid REAL DEFAULT 0,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    special_requests TEXT,
    source TEXT DEFAULT 'walk_in' CHECK(source IN ('walk_in','phone','online','agent','repeat')),
    status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed','checked_in','checked_out','cancelled','no_show')),
    cancellation_reason TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS waiter_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    clock_in TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
    clock_out TEXT,
    scheduled_hours REAL DEFAULT 8,
    actual_hours REAL,
    overtime_hours REAL DEFAULT 0,
    overtime_approved INTEGER DEFAULT 0,
    overtime_approved_by INTEGER REFERENCES users(id),
    overtime_notes TEXT,
    break_minutes INTEGER DEFAULT 0,
    date TEXT DEFAULT (date('now', '+3 hours')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS commission_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waiter_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    bill_id INTEGER REFERENCES bills(id),
    menu_item_id INTEGER REFERENCES menu_items(id),
    item_name TEXT,
    item_price REAL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    sale_amount REAL DEFAULT 0,
    commission_rate REAL DEFAULT 0,
    commission_amount REAL DEFAULT 0,
    is_expensive_item INTEGER DEFAULT 0,
    paid INTEGER DEFAULT 0,
    paid_at TEXT,
    paid_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    birthday TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_spend REAL DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze' CHECK(tier IN ('bronze','silver','gold','platinum')),
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    bill_id INTEGER REFERENCES bills(id),
    type TEXT NOT NULL CHECK(type IN ('earn','redeem','manual','expire')),
    points INTEGER NOT NULL,
    spend_amount REAL DEFAULT 0,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS business_settings (
    id INTEGER DEFAULT 1 PRIMARY KEY,
    business_name TEXT DEFAULT 'Sai Lounge',
    tagline TEXT DEFAULT 'Premium Dining Experience',
    phone TEXT,
    email TEXT,
    address TEXT,
    currency TEXT DEFAULT 'KES',
    tax_enabled INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 16,
    tax_label TEXT DEFAULT 'VAT',
    service_charge_enabled INTEGER DEFAULT 0,
    service_charge_rate REAL DEFAULT 10,
    service_charge_label TEXT DEFAULT 'Service Charge',
    loyalty_enabled INTEGER DEFAULT 1,
    loyalty_points_per_100 INTEGER DEFAULT 1,
    loyalty_redeem_rate REAL DEFAULT 1,
    loyalty_silver_threshold INTEGER DEFAULT 5000,
    loyalty_gold_threshold INTEGER DEFAULT 20000,
    loyalty_platinum_threshold INTEGER DEFAULT 50000,
    receipt_footer TEXT DEFAULT 'Thank you for dining with us!',
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    size_bytes INTEGER DEFAULT 0,
    type TEXT DEFAULT 'auto' CHECK(type IN ('auto','manual')),
    status TEXT DEFAULT 'success',
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS goods_receive_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    inventory_id INTEGER REFERENCES inventory(id),
    item_name TEXT,
    ordered_qty REAL DEFAULT 0,
    received_qty REAL DEFAULT 0,
    shortage_qty REAL DEFAULT 0,
    unit_cost REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    shortage_reason TEXT,
    condition_notes TEXT,
    received_by INTEGER REFERENCES users(id),
    received_at TEXT DEFAULT (datetime('now', '+3 hours'))
  )`);

  // Insert default business settings if not exists
  db.run(`INSERT OR IGNORE INTO business_settings (id) VALUES (1)`);

  // ==================== RUN MIGRATIONS ====================
  console.log('Running migrations for existing database...');
  
  const migrations = [
    { table: 'users', columns: [
      { name: 'commission_rate', type: 'REAL DEFAULT 3.0' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'can_manage_rooms', type: 'INTEGER DEFAULT 0' }
    ]},
    { table: 'menu_categories', columns: [
      { name: 'department', type: "TEXT DEFAULT 'kitchen'" }
    ]},
    { table: 'menu_items', columns: [
      { name: 'active', type: 'INTEGER DEFAULT 1' },
      { name: 'image_url', type: 'TEXT' },
      { name: 'happy_hour_price', type: 'REAL' },
      { name: 'unit', type: "TEXT DEFAULT 'serving'" },
      { name: 'commission_eligible', type: 'INTEGER DEFAULT 0' },
      { name: 'commission_rate', type: 'REAL DEFAULT 0' },
      { name: 'commission_threshold', type: 'REAL DEFAULT 0' }
    ]},
    { table: 'inventory', columns: [
      { name: 'department', type: "TEXT DEFAULT 'kitchen'" },
      { name: 'supplier_id', type: 'INTEGER' },
      { name: 'updated_at', type: "TEXT DEFAULT (datetime('now', '+3 hours'))" }
    ]},
    { table: 'orders', columns: [
      { name: 'room_id', type: 'INTEGER' },
      { name: 'order_type', type: "TEXT DEFAULT 'dine_in'" },
      { name: 'updated_at', type: "TEXT DEFAULT (datetime('now', '+3 hours'))" }
    ]},
    { table: 'restaurant_tables', columns: [
      { name: 'type', type: "TEXT DEFAULT 'table'" },
      { name: 'name', type: 'TEXT' }
    ]},
    { table: 'bills', columns: [
      { name: 'mpesa_ref', type: 'TEXT' },
      { name: 'tax', type: 'REAL DEFAULT 0' },
      { name: 'updated_at', type: "TEXT DEFAULT (datetime('now', '+3 hours'))" },
      { name: 'cash_amount', type: 'REAL DEFAULT 0' },
      { name: 'mpesa_amount', type: 'REAL DEFAULT 0' },
      { name: 'card_amount', type: 'REAL DEFAULT 0' },
      { name: 'cashier_id', type: 'INTEGER' },
      { name: 'paid_at', type: 'TEXT' },
      { name: 'discount', type: 'REAL DEFAULT 0' },
      { name: 'payment_method', type: 'TEXT' },
      { name: 'subtotal', type: 'REAL DEFAULT 0' },
      { name: 'customer_id', type: 'INTEGER' },
      { name: 'loyalty_points_earned', type: 'INTEGER DEFAULT 0' },
      { name: 'loyalty_points_redeemed', type: 'INTEGER DEFAULT 0' },
      { name: 'loyalty_discount', type: 'REAL DEFAULT 0' }
    ]},
    { table: 'shifts', columns: [
      { name: 'user_id', type: 'INTEGER' },
      { name: 'notes', type: 'TEXT' },
      { name: 'opening_float', type: 'REAL DEFAULT 0' },
      { name: 'closing_cash', type: 'REAL DEFAULT 0' },
      { name: 'closing_mpesa', type: 'REAL DEFAULT 0' },
      { name: 'closing_card', type: 'REAL DEFAULT 0' }
    ]},
    { table: 'purchase_orders', columns: [
      { name: 'receive_status', type: "TEXT DEFAULT 'pending'" },
      { name: 'received_amount', type: 'REAL DEFAULT 0' },
      { name: 'delivery_comments', type: 'TEXT' }
    ]},
    { table: 'purchase_order_items', columns: [
      { name: 'shortage_qty', type: 'REAL DEFAULT 0' },
      { name: 'shortage_reason', type: 'TEXT' },
      { name: 'item_notes', type: 'TEXT' },
      { name: 'receive_status', type: "TEXT DEFAULT 'pending'" }
    ]},
    { table: 'rooms', columns: [
      { name: 'guest_email', type: 'TEXT' },
      { name: 'guest_id_number', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'type', type: "TEXT DEFAULT 'standard'" },
      { name: 'rate_per_night', type: 'REAL DEFAULT 0' },
      { name: 'deposit_paid', type: 'REAL DEFAULT 0' },
      { name: 'notes', type: 'TEXT' },
      { name: 'created_at', type: "TEXT DEFAULT (datetime('now', '+3 hours'))" }
    ]},
    { table: 'requisitions', columns: [
      { name: 'approved_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'issued_by', type: 'INTEGER REFERENCES users(id)' }
    ]},
    { table: 'email_settings', columns: [
      { name: 'daily_report_time', type: "TEXT DEFAULT '20:00'" },
      { name: 'send_daily_report', type: 'INTEGER DEFAULT 0' },
      { name: 'send_weekly_report', type: 'INTEGER DEFAULT 0' },
      { name: 'send_monthly_report', type: 'INTEGER DEFAULT 0' }
    ]},
    { table: 'goods_receive_log', columns: [
      { name: 'shortage_reason', type: 'TEXT' },
      { name: 'condition_notes', type: 'TEXT' },
      { name: 'received_by', type: 'INTEGER REFERENCES users(id)' }
    ]}
  ];

  for (const { table, columns } of migrations) {
    for (const { name, type } of columns) {
      await addColumnIfNotExists(table, name, type);
    }
  }

  // ==================== SEED DATABASE IF EMPTY ====================
  const userCount = db.exec("SELECT COUNT(*) as c FROM users")[0]?.values[0][0];
  if (!userCount || userCount === 0) {
    await seedDatabase(db);
  }

  // ==================== FIX EXISTING TIMEZONES ====================
  await fixExistingTimezones(db);
  
  // ==================== CREATE TIMEZONE TRIGGERS ====================
  createTimezoneTriggers(db);

  saveDB();
  console.log('✅ Database initialized with Kenya timezone (UTC+3)');
  return db;
}

async function seedDatabase(db) {
  console.log('🌱 Seeding database with initial data...');
  
  // Seed Users
  const users = [
    ['Admin', '4000', 'admin'],
    ['Manager', '5000', 'management'],
    ['Cashier Grace', '2000', 'cashier'],
    ['Bar Attendant Mike', '6000', 'bar_attendant'],
    ['Kitchen Chef', '3000', 'kitchen'],
    ['Waiter Alice', '1001', 'waiter'],
    ['Waiter Bob', '1002', 'waiter'],
    ['Waiter Carol', '1003', 'waiter'],
  ];
  for (const [name, code, role] of users) {
    db.run("INSERT INTO users (name, code, role, can_manage_rooms) VALUES (?, ?, ?, ?)", [name, code, role, role === 'admin' || role === 'management' ? 1 : 0]);
  }

  // Seed Tables
  for (let i = 1; i <= 20; i++) {
    db.run("INSERT INTO restaurant_tables (number, status, type) VALUES (?, 'free', 'table')", [i]);
  }
  
  // Seed Rooms
  const rooms = [
    ['R01', 'Executive Suite', 'suite', 12000, 'available'],
    ['R02', 'Deluxe King', 'deluxe', 8000, 'available'],
    ['R03', 'Deluxe Twin', 'deluxe', 7500, 'available'],
    ['R04', 'Standard Double', 'standard', 5000, 'available'],
    ['R05', 'Standard Single', 'standard', 4000, 'available'],
    ['R06', 'Family Suite', 'suite', 15000, 'available'],
    ['R07', 'Deluxe Queen', 'deluxe', 8500, 'available'],
    ['R08', 'Standard Twin', 'standard', 4500, 'available'],
    ['R09', 'Presidential Suite', 'suite', 25000, 'available'],
    ['R10', 'Budget Single', 'standard', 3500, 'available'],
  ];
  for (const [number, name, type, rate, status] of rooms) {
    db.run("INSERT INTO rooms (number, name, type, rate_per_night, status) VALUES (?, ?, ?, ?, ?)", [number, name, type, rate, status]);
  }

  // Seed Categories
  const categories = [
    ['Breakfast', '🍳', 'kitchen', 1],
    ['Starters', '🥗', 'kitchen', 2],
    ['Grills & Choma', '🔥', 'kitchen', 3],
    ['Main Dishes', '🍲', 'kitchen', 4],
    ['Burgers & Street Food', '🍔', 'kitchen', 5],
    ['Sides & Staples', '🍚', 'kitchen', 6],
    ['Desserts', '🍨', 'kitchen', 7],
    ['Hot Beverages', '☕', 'kitchen', 8],
    ['Juices & Smoothies', '🥤', 'bar', 9],
    ['Beers & Ciders', '🍺', 'bar', 10],
    ['Spirits & Cocktails', '🥃', 'bar', 11],
    ['Sodas & Water', '🥤', 'bar', 12],
  ];
  for (const [name, icon, dept, sort] of categories) {
    db.run("INSERT INTO menu_categories (name, icon, department, sort_order) VALUES (?, ?, ?, ?)", [name, icon, dept, sort]);
  }

  const catRows = db.exec("SELECT id, name FROM menu_categories")[0].values;
  const catMap = {};
  for (const [id, name] of catRows) catMap[name] = id;

  // Seed Menu Items
  const menuItems = [
    [catMap['Breakfast'], 'Sai Lounge Big Breakfast', 600, 'Eggs, sausage, bacon, beans, toast', '🍳'],
    [catMap['Breakfast'], 'English Breakfast', 550, '2 Eggs, sausage, beans, toast', '🥚'],
    [catMap['Breakfast'], 'Eggs Any Style', 250, 'Boiled/Fried/Scrambled/Omelette', '🍳'],
    [catMap['Breakfast'], 'Pancakes (3pcs)', 350, 'With honey or syrup', '🥞'],
    [catMap['Starters'], 'Samosa (2pcs)', 120, 'Crispy pastry', '🥟'],
    [catMap['Starters'], 'Chicken Wings (6pcs)', 400, 'Crispy seasoned wings', '🍗'],
    [catMap['Grills & Choma'], 'Nyama Choma Beef (500g)', 600, 'With kachumbari & ugali', '🥩'],
    [catMap['Grills & Choma'], 'Nyama Choma Beef (1kg)', 1000, 'With kachumbari & ugali', '🥩'],
    [catMap['Main Dishes'], 'Beef Wet Fry', 450, 'Tender beef in tomato sauce', '🍲'],
    [catMap['Main Dishes'], 'Beef Steak + Fries', 900, 'Grilled steak with sides', '🥩'],
    [catMap['Burgers & Street Food'], 'Chicken Burger + Fries', 450, 'Juicy chicken burger', '🍔'],
    [catMap['Burgers & Street Food'], 'Beef Burger + Fries', 450, 'Classic beef burger', '🍔'],
    [catMap['Beers & Ciders'], 'Tusker (500ml)', 300, 'Kenyan lager', '🍺'],
    [catMap['Beers & Ciders'], 'White Cap (500ml)', 300, 'Kenyan lager', '🍺'],
    [catMap['Beers & Ciders'], 'Heineken (330ml)', 350, 'Premium lager', '🍺'],
    [catMap['Spirits & Cocktails'], 'Jameson Whisky', 450, 'Irish whiskey - per tot', '🥃'],
    [catMap['Spirits & Cocktails'], 'Jack Daniels', 500, 'Tennessee whiskey - per tot', '🥃'],
    [catMap['Spirits & Cocktails'], 'Gilbeys Gin', 300, 'Classic gin - per tot', '🥃'],
    [catMap['Spirits & Cocktails'], 'Smirnoff Vodka', 300, 'Vodka - per tot', '🥃'],
    [catMap['Sodas & Water'], 'Coke (300ml)', 70, 'Coca-Cola', '🥤'],
    [catMap['Sodas & Water'], 'Red Bull (330ml)', 250, 'Energy drink', '🥤'],
  ];

  for (const [cat_id, name, price, desc, emoji] of menuItems) {
    db.run("INSERT INTO menu_items (category_id, name, price, description, image_emoji) VALUES (?, ?, ?, ?, ?)",
      [cat_id, name, price, desc, emoji]);
  }

  // Seed Suppliers
  const suppliers = [
    ['Tusker Distributors', 'John Kamau', '0722 111 222', 'john@tusker.co.ke', 'Net 30'],
    ['Fresh Farms Produce', 'Mary Wanjiku', '0733 444 555', 'mary@freshfarms.co.ke', 'COD'],
    ['Metro Cash & Carry', 'Peter Odhiambo', '0711 777 888', 'peter@metro.co.ke', 'Net 7'],
  ];
  for (const [name, contact, phone, email, terms] of suppliers) {
    db.run("INSERT INTO suppliers (name, contact_person, phone, email, payment_terms) VALUES (?, ?, ?, ?, ?)",
      [name, contact, phone, email, terms]);
  }

  // Seed Inventory
  const inventory = [
    ['Tusker Bottles', 'Beer', 'bar', 96, 'bottles', 24, 220],
    ['White Cap Bottles', 'Beer', 'bar', 96, 'bottles', 24, 220],
    ['Jameson 750ml', 'Whisky', 'bar', 8, 'bottles', 2, 2550],
    ['Jack Daniels 750ml', 'Whisky', 'bar', 8, 'bottles', 2, 3550],
    ['Gilbeys Gin 750ml', 'Gin', 'bar', 12, 'bottles', 3, 1297],
    ['Smirnoff 750ml', 'Vodka', 'bar', 8, 'bottles', 2, 1000],
    ['Beef (kg)', 'Meat', 'kitchen', 20, 'kg', 5, 600],
    ['Chicken (kg)', 'Meat', 'kitchen', 15, 'kg', 5, 350],
    ['Eggs', 'Dairy', 'kitchen', 60, 'pcs', 12, 15],
    ['Sausages', 'Meat', 'kitchen', 30, 'pcs', 10, 25],
    ['Bacon', 'Meat', 'kitchen', 15, 'kg', 5, 450],
    ['Beans', 'Canned', 'kitchen', 20, 'cans', 5, 80],
    ['Bread', 'Bakery', 'kitchen', 20, 'loaves', 5, 55],
    ['Cooking Oil', 'Oils', 'kitchen', 20, 'liters', 3, 180],
    ['Flour', 'Dry Goods', 'kitchen', 30, 'kg', 5, 65],
    ['Milk', 'Dairy', 'kitchen', 20, 'liters', 5, 55],
    ['Coke 300ml', 'Soda', 'bar', 120, 'cans', 24, 65],
    ['Red Bull 330ml', 'Energy', 'bar', 60, 'cans', 12, 100],
  ];
  for (const [name, cat, dept, qty, unit, reorder, cost] of inventory) {
    db.run("INSERT INTO inventory (name, category, department, quantity, unit, reorder_level, cost_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, cat, dept, qty, unit, reorder, cost]);
  }

  // Seed Promotions
  db.run("INSERT INTO promotions (name, type, value, active, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['Happy Hour', 'happy_hour', 15, 1, '17:00', '19:00', '15% off all bar items during happy hour']);
  db.run("INSERT INTO promotions (name, type, value, active, description) VALUES (?, ?, ?, ?, ?)",
    ['Lunch Discount', 'percentage', 10, 0, '10% off all food 12pm-2pm']);

  // Seed Happy Hour Schedule
  db.run("INSERT INTO happy_hour_schedules (name, start_time, end_time, discount_percent, active) VALUES (?, ?, ?, ?, ?)",
    ['Evening Happy Hour', '17:00', '19:00', 15, 1]);

  // Seed Email Settings
  db.run("INSERT INTO email_settings (smtp_host, smtp_port, smtp_user, from_name, send_daily_report, send_weekly_report, send_monthly_report, send_eod_report) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['smtp.gmail.com', 587, '', 'Sai Lounge POS', 0, 0, 0, 0]);
  
  // Seed M-Pesa Settings
  db.run("INSERT INTO mpesa_settings (environment) VALUES (?)", ['sandbox']);

  console.log('✅ Database seeded successfully!');
}

async function query(sql, params = []) {
  const database = await getDB();
  try {
    const stmt = database.prepare(sql);
    const results = [];
    stmt.bind(params);
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (err) {
    console.error('DB query error:', sql.substring(0, 80), err.message);
    throw err;
  }
}

async function run(sql, params = []) {
  const database = await getDB();
  try {
    database.run(sql, params);
    const lastId = database.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0];
    saveDB();
    return { lastId };
  } catch (err) {
    console.error('DB run error:', sql.substring(0, 80), err.message);
    throw err;
  }
}

async function runTransaction(operations) {
  const database = await getDB();
  try {
    database.run('BEGIN TRANSACTION');
    let lastId = null;
    for (const { sql, params = [] } of operations) {
      database.run(sql, params);
      lastId = database.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0];
    }
    database.run('COMMIT');
    saveDB();
    return { lastId };
  } catch (err) {
    try { database.run('ROLLBACK'); } catch {}
    console.error('DB transaction error:', err.message);
    throw err;
  }
}

module.exports = { initializeDatabase, query, run, runTransaction, saveDB, getDB, getKenyaTime, toKenyaTime };