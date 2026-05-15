const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const authController = require('../controllers/authController');
const ordersController = require('../controllers/ordersController');
const billingController = require('../controllers/billingController');
const menuController = require('../controllers/menuController');
const tablesController = require('../controllers/tablesController');
const reportsController = require('../controllers/reportsController');
const roomController = require('../controllers/roomController');

const reservationController = require('../controllers/reservationController');
const customerController    = require('../controllers/customerController');

// ==================== PUBLIC TEST ENDPOINTS ====================
// Email test endpoint (no auth required for testing OAuth2)
router.get('/test-email', async (req, res) => {
  try {
    const { sendTestEmail } = require('../services/emailService');
    const result = await sendTestEmail('shobotelucia@gmail.com');
    
    if (result) {
      res.json({ 
        success: true, 
        message: '✅ Test email sent successfully! Check shobotelucia@gmail.com' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: '❌ Email not configured. Check .env file and OAuth2 credentials.' 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ==================== AUTH ====================
router.post('/auth/login', authController.login);

// ==================== PASSWORD RESET ====================
const passwordController = require('../controllers/passwordController');
router.post('/password/reset-request', passwordController.requestReset);
router.get('/password/verify-token/:token', passwordController.verifyToken);
router.post('/password/reset', passwordController.resetPassword);
// Admin/management can directly reset any user's PIN from the Users page
router.post('/password/admin-reset', authenticate, requireRole('admin', 'management'), passwordController.adminResetPassword);
router.put('/user/email', authenticate, passwordController.updateEmail);
router.get('/user/profile', authenticate, async (req, res) => {
  try {
    const { query } = require('../models/database');
    const user = await query("SELECT id, name, email, role FROM users WHERE id = ?", [req.user.id]);
    res.json(user[0] || {});
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EMAIL REPORT SETTINGS ====================
router.put('/settings/report-emails', authenticate, requireRole('admin', 'management'), async (req, res) => {
  try {
    const { report_emails, daily_report_time, send_daily_report, send_weekly_report, send_monthly_report, send_eod_report } = req.body;
    const { run } = require('../models/database');
    await run(`UPDATE email_settings SET 
      report_emails = ?, 
      daily_report_time = ?, 
      send_daily_report = ?, 
      send_weekly_report = ?, 
      send_monthly_report = ?,
      send_eod_report = ?,
      updated_at = datetime('now')
    `, [report_emails, daily_report_time, send_daily_report || 0, send_weekly_report || 0, send_monthly_report || 0, send_eod_report || 0]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports/send-test-email', authenticate, requireRole('admin', 'management'), async (req, res) => {
  try {
    const { sendTestEmail } = require('../services/emailService');
    const email = req.body.email || process.env.EMAIL_USER;
    const success = await sendTestEmail(email);
    res.json({ success, message: success ? `Test email sent to ${email}` : 'Failed to send' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TABLES ====================
router.get('/tables', authenticate, tablesController.getTables);
router.put('/tables/:id', authenticate, tablesController.updateTableStatus);

// ==================== TABLE & ROOM MANAGEMENT (Admin/Management) ====================
router.post('/tables', authenticate, requireRole('admin', 'management'), roomController.createTable);
router.put('/tables/:id', authenticate, requireRole('admin', 'management'), roomController.updateTable);
router.delete('/tables/:id', authenticate, requireRole('admin', 'management'), roomController.deleteTable);

// ==================== ROOMS ====================
router.get('/rooms', authenticate, roomController.getRooms);
router.post('/rooms', authenticate, requireRole('admin', 'management'), roomController.createRoom);
router.put('/rooms/:id', authenticate, requireRole('admin', 'management'), roomController.updateRoom);
router.delete('/rooms/:id', authenticate, requireRole('admin', 'management'), roomController.deleteRoom);

// Guest operations
router.post('/rooms/:id/checkin', authenticate, requireRole('admin', 'management', 'waiter'), roomController.checkIn);
router.post('/rooms/:id/checkout', authenticate, requireRole('admin', 'management', 'cashier'), roomController.checkOut);

// ==================== ROOM BILLS ====================
router.get('/room-bills', authenticate, roomController.getRoomBills);
router.get('/room-bills/:id', authenticate, roomController.getRoomBill);
router.post('/room-bills/:billId/extra-charge', authenticate, requireRole('admin', 'management', 'cashier'), roomController.addExtraCharge);
router.delete('/room-extra-charges/:chargeId', authenticate, requireRole('admin', 'management', 'cashier'), roomController.removeExtraCharge);
router.post('/room-bills/:id/pay', authenticate, requireRole('admin', 'management', 'cashier'), roomController.processRoomPayment);

// Charge to room
router.post('/rooms/:roomId/charge', authenticate, roomController.chargeToRoom);

// ==================== MENU ====================
router.get('/menu/categories', authenticate, menuController.getCategories);
router.get('/menu/items', authenticate, menuController.getMenuItems);
router.post('/menu/items', authenticate, requireRole('admin', 'management'), menuController.createMenuItem);
router.put('/menu/items/:id', authenticate, requireRole('admin', 'management'), menuController.updateMenuItem);
router.delete('/menu/items/:id', authenticate, requireRole('admin', 'management'), menuController.deleteMenuItem);

// ==================== ORDERS ====================
router.get('/orders', authenticate, ordersController.getOrders);
router.get('/orders/table/:tableId', authenticate, ordersController.getOrderByTable);
router.post('/orders', authenticate, ordersController.createOrder);
router.put('/orders/:id', authenticate, ordersController.updateOrder);
router.post('/orders/:id/send', authenticate, ordersController.sendToKitchen);
router.put('/orders/:id/kitchen-status', authenticate, ordersController.updateKitchenStatus);
router.get('/orders/kitchen', authenticate, ordersController.getKitchenOrders);

// ==================== BILLING ====================
// ==================== BILLING ====================
// IMPORTANT: static paths (/bills/refresh, /bills/merge*, /bills/add-items)
// MUST be declared BEFORE parameterised paths (/bills/:id) — Express matches top-down.
router.get('/bills',                  authenticate,                                                   billingController.getUnpaidBills);
router.post('/bills',                 authenticate,                                                   billingController.createBill);

// Static sub-paths — registered before /bills/:id so Express doesn't treat these as an :id value
router.post('/bills/refresh',         authenticate,                                                   billingController.refreshBillTotal);
router.post('/bills/add-items',       authenticate,                                                   billingController.addItemsToBill);
router.post('/bills/merge-preview',   authenticate, requireRole('admin','management','cashier','waiter'), billingController.mergeBillPreview);
router.post('/bills/merge',           authenticate, requireRole('admin','management','cashier','waiter'), billingController.mergeBills);

// Parameterised paths — after all static paths
router.get('/bills/:id',              authenticate,                                                   billingController.getBillDetails);
router.post('/bills/:id/pay',         authenticate, requireRole('admin','management','cashier'),      billingController.processPayment);
router.put('/bills/:id/refresh',      authenticate,                                                   billingController.refreshBillById);

// ==================== REQUISITIONS ====================
router.get('/reports/requisitions', authenticate, reportsController.getRequisitions);
router.post('/requisitions', authenticate, reportsController.createRequisition);
router.put('/requisitions/:id/status', authenticate, requireRole('admin', 'management'), reportsController.updateRequisitionStatus);

// ==================== REPORTS & DASHBOARD ====================
router.get('/dashboard/stats', authenticate, reportsController.getDashboardStats);
router.get('/reports/sales', authenticate, reportsController.getSalesReport);
router.get('/reports/inventory', authenticate, reportsController.getInventoryReport);
router.get('/reports/stock', authenticate, reportsController.getStockReport);
router.get('/reports/commissions', authenticate, reportsController.getWaiterCommissions);
router.get('/reports/purchases', authenticate, reportsController.getPurchaseReport);
router.get('/reports/fast-slow', authenticate, reportsController.getFastSlowItems);

// ==================== INVENTORY ====================
router.put('/inventory/:id', authenticate, requireRole('admin', 'management', 'bar_attendant'), reportsController.updateInventory);
router.post('/inventory', authenticate, requireRole('admin', 'management'), reportsController.addInventoryItem);

// ==================== USERS ====================
router.get('/users', authenticate, requireRole('admin', 'management'), reportsController.getUsers);
router.post('/users', authenticate, requireRole('admin', 'management'), reportsController.createUser);
router.put('/users/:id', authenticate, requireRole('admin', 'management'), reportsController.updateUser);
router.delete('/users/:id', authenticate, requireRole('admin', 'management'), reportsController.deleteUser);

// ==================== NOTIFICATIONS ====================
router.get('/notifications', authenticate, reportsController.getNotifications);
router.put('/notifications/:id/read', authenticate, reportsController.markNotificationRead);

// ==================== SHIFTS ====================
router.get('/shifts', authenticate, reportsController.getShifts);
router.post('/shifts/open', authenticate, reportsController.openShift);
router.put('/shifts/:id/close', authenticate, reportsController.closeShift);

// ==================== M-PESA ====================
router.post('/mpesa/initiate', authenticate, reportsController.initiateMpesa);

// ==================== SETTINGS ====================
router.get('/settings', authenticate, reportsController.getSettings);
router.put('/settings/email', authenticate, requireRole('admin', 'management'), reportsController.updateEmailSettings);
router.put('/settings/mpesa', authenticate, requireRole('admin', 'management'), reportsController.updateMpesaSettings);

// ==================== SUPPLIERS ====================
router.get('/suppliers', authenticate, reportsController.getSuppliers);
router.post('/suppliers', authenticate, requireRole('admin', 'management'), reportsController.createSupplier);
router.put('/suppliers/:id', authenticate, requireRole('admin', 'management'), reportsController.updateSupplier);

// ==================== PURCHASE ORDERS ====================
router.get('/purchase-orders',                    authenticate, reportsController.getPurchaseOrders);
router.post('/purchase-orders',                   authenticate, requireRole('admin','management'), reportsController.createPurchaseOrder);
router.put('/purchase-orders/:id/receive',        authenticate, requireRole('admin','management'), reportsController.receivePurchaseOrder);
router.get('/purchase-orders/:id/receive-log',    authenticate, reportsController.getPurchaseOrderReceiveLog);

// ==================== ROOM RESERVATIONS ====================
router.get('/reservations',                       authenticate, reservationController.getReservations);
router.get('/reservations/availability',          authenticate, reservationController.getRoomAvailability);
router.get('/reservations/:id',                   authenticate, reservationController.getReservation);
router.post('/reservations',                      authenticate, requireRole('admin','management','cashier','waiter'), reservationController.createReservation);
router.put('/reservations/:id',                   authenticate, requireRole('admin','management','cashier'), reservationController.updateReservation);
router.post('/reservations/:id/checkin',          authenticate, requireRole('admin','management','cashier'), reservationController.checkInFromReservation);

// ==================== WAITER SHIFTS ====================
router.get('/waiter-shifts',                      authenticate, reservationController.getWaiterShifts);
router.get('/waiter-shifts/active',               authenticate, reservationController.getActiveWaiters);
router.post('/waiter-shifts/clock-in',            authenticate, reservationController.clockIn);
router.post('/waiter-shifts/clock-out',           authenticate, reservationController.clockOut);
router.put('/waiter-shifts/:id/approve-overtime', authenticate, requireRole('admin','management'), reservationController.approveOvertime);

// ==================== COMMISSION LOG ====================
router.get('/commissions',                        authenticate, reservationController.getCommissionLog);
router.post('/commissions/pay',                   authenticate, requireRole('admin','management'), reservationController.payCommission);

// ==================== PROMOTIONS ====================
router.get('/promotions', authenticate, reportsController.getPromotions);
router.post('/promotions', authenticate, requireRole('admin', 'management'), reportsController.createPromotion);
router.put('/promotions/:id', authenticate, requireRole('admin', 'management'), reportsController.updatePromotion);

// ==================== BUFFET ====================
router.get('/buffet-bookings', authenticate, reportsController.getBuffetBookings);
router.post('/buffet-bookings', authenticate, reportsController.createBuffetBooking);

// ==================== CUSTOMERS & LOYALTY ====================
router.get('/customers',                          authenticate, customerController.getCustomers);
router.get('/customers/lookup',                   authenticate, customerController.lookupCustomer);
router.get('/customers/:id',                      authenticate, customerController.getCustomer);
router.post('/customers',                         authenticate, customerController.createCustomer);
router.put('/customers/:id',                      authenticate, customerController.updateCustomer);
router.post('/customers/:id/adjust-points',       authenticate, requireRole('admin','management','cashier'), customerController.manualAdjustPoints);
router.post('/loyalty/earn',                      authenticate, customerController.earnPoints);
router.post('/loyalty/redeem',                    authenticate, customerController.redeemPoints);

// ==================== BUSINESS INSIGHTS ====================
router.get('/insights',                           authenticate, customerController.getInsights);
router.get('/quick-stats',                        authenticate, customerController.getQuickStats);

// ==================== BUSINESS SETTINGS ====================
router.get('/settings/business',                  authenticate, customerController.getBusinessSettings);
router.put('/settings/business',                  authenticate, requireRole('admin','management'), customerController.updateBusinessSettings);

// ==================== BACKUPS ====================
router.get('/backups',                            authenticate, requireRole('admin','management'), customerController.getBackupList);
router.post('/backups/trigger',                   authenticate, requireRole('admin','management'), customerController.triggerBackup);

module.exports = router;