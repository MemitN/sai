// ==================== TIMEZONE FIX ====================
// Force Kenya/East Africa timezone - MUST be first line
process.env.TZ = 'Africa/Nairobi';
// For Windows: process.env.TZ = 'E. Africa Standard Time';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDatabase, query, run } = require('./models/database');
const routes = require('./routes/index');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  } 
});

// Enhanced CORS for network access
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { req.io = io; next(); });

// ==================== STATIC FILES WITH NETWORK SUPPORT ====================
// Helper function to set proper headers for images and static files
const setStaticHeaders = (res, filePath) => {
  // Allow all devices to access images from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Accept, Content-Type');
  
  // Set correct MIME types for images
  if (filePath && filePath.match(/\.(jpg|jpeg|png|gif|webp|ico|svg)$/i)) {
    const ext = path.extname(filePath).substring(1).toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'ico': 'image/x-icon',
      'svg': 'image/svg+xml'
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hour cache
  }
};

// Serve static files from public directory (where React build goes)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => setStaticHeaders(res, filePath)
}));

// Serve images from uploads directory if it exists
const uploadsPath = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res, filePath) => setStaticHeaders(res, filePath)
  }));
}

// Also serve any images from frontend public folder if it exists (for development)
const frontendPublicPath = path.join(__dirname, '../frontend/public');
if (fs.existsSync(frontendPublicPath)) {
  app.use('/', express.static(frontendPublicPath, {
    setHeaders: (res, filePath) => setStaticHeaders(res, filePath)
  }));
}

// Handle OPTIONS preflight requests for all routes
app.options('*', cors());

// API routes
app.use('/api', routes);

// Get local IP address for network display
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Serve React app for all non-API routes (catch-all)
app.get('*', (req, res) => {
  // Check if we have the React build in public folder
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Try frontend build folder
    const frontendBuildPath = path.join(__dirname, '../frontend/build', 'index.html');
    if (fs.existsSync(frontendBuildPath)) {
      res.sendFile(frontendBuildPath);
    } else {
      res.status(404).send('Application not built. Please run npm run build first.');
    }
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  console.log(`🔌 New client connected: ${socket.id} from ${clientIP}`);
  
  socket.on('join:kitchen', () => {
    socket.join('kitchen');
    console.log('👨‍🍳 Client joined kitchen channel');
  });
  
  socket.on('join:cashier', () => {
    socket.join('cashier');
    console.log('💰 Client joined cashier channel');
  });
  
  socket.on('join:waiter', (id) => {
    socket.join(`waiter:${id}`);
    console.log(`👨‍💼 Waiter ${id} joined their channel`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ==================== EMAIL SERVICES ====================
const { sendDailyReport, sendWeeklyReport, sendMonthlyReport, sendTestEmail } = require('./services/emailService');

// Schedule automated email reports
function scheduleEmailReports() {
  const now = new Date();
  
  // Daily report at 8:00 PM
  const dailyTime = new Date(now);
  dailyTime.setHours(20, 0, 0, 0);
  if (dailyTime <= now) dailyTime.setDate(dailyTime.getDate() + 1);
  const dailyDelay = dailyTime - now;
  setTimeout(async () => {
    console.log('📧 Sending daily report...');
    await sendDailyReport();
    scheduleEmailReports(); 
  }, dailyDelay);
  
  // Weekly report - Monday at 9:00 AM
  const weeklyTime = new Date(now);
  const daysUntilMonday = (1 - now.getDay() + 7) % 7;
  weeklyTime.setDate(now.getDate() + daysUntilMonday);
  weeklyTime.setHours(9, 0, 0, 0);
  if (weeklyTime <= now) weeklyTime.setDate(weeklyTime.getDate() + 7);
  const weeklyDelay = weeklyTime - now;
  setTimeout(async () => {
    console.log('📧 Sending weekly report...');
    await sendWeeklyReport();
  }, weeklyDelay);
  
  // Monthly report - 1st day of month at 10:00 AM
  const monthlyTime = new Date(now);
  monthlyTime.setDate(1);
  monthlyTime.setHours(10, 0, 0, 0);
  if (monthlyTime <= now) monthlyTime.setMonth(monthlyTime.getMonth() + 1);
  const monthlyDelay = monthlyTime - now;
  setTimeout(async () => {
    console.log('📧 Sending monthly report...');
    await sendMonthlyReport();
  }, monthlyDelay);
  
  console.log(`📧 Email reports scheduled:`);
  console.log(`   - Daily at 8:00 PM (in ${Math.round(dailyDelay / 1000 / 60)} minutes)`);
  console.log(`   - Weekly on Monday at 9:00 AM`);
  console.log(`   - Monthly on 1st at 10:00 AM`);
}

// End-of-day report scheduler (runs at midnight)
function scheduleEODReport() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow - now;
  
  setTimeout(async () => {
    try {
      const settings = await query("SELECT * FROM email_settings LIMIT 1");
      if (settings.length && settings[0].send_eod_report && settings[0].report_emails) {
        const today = new Date().toISOString().split('T')[0];
        const sales = await query(`SELECT COUNT(*) as orders,COALESCE(SUM(total),0) as total,COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) as cash,COALESCE(SUM(CASE WHEN payment_method='mpesa' THEN total ELSE 0 END),0) as mpesa,COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) as card FROM bills WHERE status='paid' AND date(paid_at)=?`, [today]);
        
        const html = `<!DOCTYPE html>
        <html>
        <head><title>End of Day Report</title></head>
        <body style="font-family: Arial;">
          <h2>End of Day Report - ${today}</h2>
          <p><strong>Total Sales:</strong> KES ${(sales[0]?.total || 0).toLocaleString()}</p>
          <p><strong>Total Orders:</strong> ${sales[0]?.orders || 0}</p>
          <p><strong>Cash:</strong> KES ${(sales[0]?.cash || 0).toLocaleString()}</p>
          <p><strong>M-Pesa:</strong> KES ${(sales[0]?.mpesa || 0).toLocaleString()}</p>
          <p><strong>Card:</strong> KES ${(sales[0]?.card || 0).toLocaleString()}</p>
          <hr>
          <p>Sai Lounge POS System</p>
        </body>
        </html>`;
        
        const { sendReport, getAllReportRecipients } = require('./services/emailService');
        const recipients = await getAllReportRecipients(settings[0].report_emails);
        await sendReport(recipients, `End of Day Report - ${today}`, html);
        console.log('📧 End of day report sent');
      }
    } catch(e) { console.error('EOD report error:', e); }
    scheduleEODReport();
  }, msUntilMidnight);
}

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const success = await sendTestEmail(process.env.EMAIL_USER);
    if (success) {
      res.json({ success: true, message: 'Test email sent successfully!' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send test email. Check console for errors.' });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to fix missing columns
async function fixMissingColumns() {
  console.log('🔧 Checking for missing columns...');
  
  // Check and add active column to menu_items
  try {
    const columns = await query("PRAGMA table_info(menu_items)");
    const hasActive = columns.some(col => col.name === 'active');
    if (!hasActive) {
      await run("ALTER TABLE menu_items ADD COLUMN active INTEGER DEFAULT 1");
      console.log('✓ Added active column to menu_items');
    }
  } catch(e) {
    if (!e.message.includes('duplicate column')) {
      console.log('⚠️ Could not add active column:', e.message);
    }
  }
  
  // Check and add updated_at column to bills (without default to avoid SQLite limitation)
  try {
    const columns = await query("PRAGMA table_info(bills)");
    const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
    if (!hasUpdatedAt) {
      await run("ALTER TABLE bills ADD COLUMN updated_at TEXT");
      // Set initial values from created_at
      await run("UPDATE bills SET updated_at = created_at WHERE updated_at IS NULL");
      console.log('✓ Added updated_at column to bills');
    }
  } catch(e) {
    if (!e.message.includes('duplicate column')) {
      console.log('⚠️ Could not add updated_at column:', e.message);
    }
  }
  
  // Check and add missing commission columns to menu_items
  try {
    const columns = await query("PRAGMA table_info(menu_items)");
    const hasCommissionEligible = columns.some(col => col.name === 'commission_eligible');
    if (!hasCommissionEligible) {
      await run("ALTER TABLE menu_items ADD COLUMN commission_eligible INTEGER DEFAULT 0");
      await run("ALTER TABLE menu_items ADD COLUMN commission_rate REAL DEFAULT 0");
      await run("ALTER TABLE menu_items ADD COLUMN commission_threshold REAL DEFAULT 0");
      console.log('✓ Added commission columns to menu_items');
    }
  } catch(e) {
    console.log('⚠️ Commission columns may already exist:', e.message);
  }
  
  // Check and add missing loyalty discount column to bills
  try {
    const columns = await query("PRAGMA table_info(bills)");
    const hasLoyaltyDiscount = columns.some(col => col.name === 'loyalty_discount');
    if (!hasLoyaltyDiscount) {
      await run("ALTER TABLE bills ADD COLUMN loyalty_discount REAL DEFAULT 0");
      console.log('✓ Added loyalty_discount column to bills');
    }
  } catch(e) {
    console.log('⚠️ loyalty_discount column may already exist:', e.message);
  }
  
  console.log('✅ Database schema check complete');
}

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Verify timezone is set correctly
    console.log(`🕐 Server Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`🕐 Current Server Time: ${new Date().toLocaleString('en-KE')}`);
    
    await initializeDatabase();
    
    // Fix missing columns after initialization
    await fixMissingColumns();
    
    // Update email_settings with default values if missing
    const settings = await query("SELECT * FROM email_settings LIMIT 1");
    if (!settings.length) {
      await run(`INSERT INTO email_settings (smtp_host, smtp_port, from_name, send_daily_report, send_weekly_report, send_monthly_report, send_eod_report) 
        VALUES ('smtp.gmail.com', 587, 'Sai Lounge POS', 0, 0, 0, 0)`);
      console.log('📧 Default email settings created');
    }
    
    const localIP = getLocalIP();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🚀 Sai Lounge POS v2 is RUNNING!`);
      console.log(`${'='.repeat(50)}`);
      console.log(`\n📍 ACCESS FROM ANY DEVICE ON THE NETWORK:`);
      console.log(`   http://${localIP}:${PORT}`);
      console.log(`\n💻 ACCESS FROM THIS COMPUTER:`);
      console.log(`   http://localhost:${PORT}`);
      console.log(`\n🕐 TIMEZONE: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      console.log(`🕐 Current Time: ${new Date().toLocaleString('en-KE')}`);
      console.log(`\n${'='.repeat(50)}`);
      console.log(`\n👥 Default Access Codes:`);
      console.log(`   Admin:         4000`);
      console.log(`   Management:    5000`);
      console.log(`   Cashier:       2000`);
      console.log(`   Bar Attendant: 6000`);
      console.log(`   Kitchen:       3000`);
      console.log(`   Waiter 1:      1001`);
      console.log(`   Waiter 2:      1002`);
      console.log(`   Waiter 3:      1003`);
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🔌 WebSocket server ready for real-time updates`);
      console.log(`📡 Server listening on 0.0.0.0:${PORT} (all network interfaces)`);
      
      // Check email configuration
      if (process.env.CLIENT_ID && process.env.REFRESH_TOKEN) {
        console.log(`\n📧 Email configured with OAuth2 (Gmail)`);
        console.log(`   Sending from: ${process.env.EMAIL_USER}`);
      } else {
        console.log(`\n⚠️ Email not configured. Add .env file with CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN`);
      }
      console.log(`${'='.repeat(50)}\n`);
    });
    
    scheduleEODReport();
    scheduleEmailReports();
    scheduleAutoBackup();

  } catch(err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// ── Auto Backup at 3 AM daily ────────────────────────────────────────────
function scheduleAutoBackup() {
  function nextBackupMs() {
    const now  = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }
  setTimeout(async function doBackup() {
    try {
      const { performBackup } = require('./controllers/customerController');
      await performBackup('auto');
    } catch(err) {
      console.error('Auto backup failed:', err.message);
    }
    setTimeout(doBackup, nextBackupMs());
  }, nextBackupMs());
  console.log('💾 Auto backup scheduled daily at 3:00 AM');
}

start();