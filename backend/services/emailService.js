// services/emailService.js — Sai Lounge POS
// OAuth2 (Gmail) primary, SMTP fallback
// Auto-sends reports to ALL admin/management users + any configured emails

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { query } = require('../models/database');
require('dotenv').config();

function fmt(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

let oAuth2Client = null;

function initOAuth2() {
  if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.REFRESH_TOKEN) {
    oAuth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI || 'https://developers.google.com/oauthplayground'
    );
    oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
    return true;
  }
  return false;
}

async function getOAuth2Transporter() {
  if (!oAuth2Client && !initOAuth2()) return null;
  try {
    const accessToken = await oAuth2Client.getAccessToken();
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });
  } catch (error) {
    console.error('OAuth2 transporter error:', error.message);
    return null;
  }
}

async function getEmailSettings() {
  try {
    const s = await query('SELECT * FROM email_settings LIMIT 1');
    return s.length ? s[0] : null;
  } catch (e) { return null; }
}

async function getTransporter() {
  if (process.env.CLIENT_ID && process.env.REFRESH_TOKEN) {
    const t = await getOAuth2Transporter();
    if (t) { console.log('📧 Using OAuth2 (Gmail)'); return t; }
  }
  const settings = await getEmailSettings();
  if (settings && settings.smtp_host && settings.smtp_user) {
    console.log('📧 Using SMTP from database');
    return nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: (settings.smtp_port || 587) === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });
  }
  return null;
}

async function getSenderEmail() {
  if (process.env.EMAIL_USER) return process.env.EMAIL_USER;
  const s = await getEmailSettings();
  return s ? (s.from_email || s.smtp_user) : null;
}

// ── Collect ALL recipients: admins + managers + configured emails ──
async function getAllReportRecipients(extraEmails) {
  const set = new Set();
  try {
    const staff = await query(
      "SELECT email FROM users WHERE role IN ('admin','management') AND active=1 AND email IS NOT NULL AND email!=''"
    );
    staff.forEach(u => set.add(u.email.trim().toLowerCase()));
  } catch (e) {}
  try {
    const s = await getEmailSettings();
    if (s && s.report_emails) {
      s.report_emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean).forEach(e => set.add(e));
    }
  } catch (e) {}
  if (extraEmails) {
    String(extraEmails).split(',').map(e => e.trim().toLowerCase()).filter(Boolean).forEach(e => set.add(e));
  }
  return [...set].join(', ');
}

// ── Core send function ──
async function sendReport(recipients, subject, htmlContent) {
  const transporter = await getTransporter();
  const fromEmail = await getSenderEmail();
  
  if (!transporter || !fromEmail) {
    console.log('⚠️ Email not configured. Skipping send to:', recipients);
    return false;
  }
  
  const to = (recipients && String(recipients).trim()) ? recipients : await getAllReportRecipients();
  if (!to) { 
    console.log('⚠️ No report recipients found. Skipping.'); 
    return false; 
  }
  
  try {
    const info = await transporter.sendMail({
      from: `"Sai Lounge POS" <${fromEmail}>`,
      to, 
      subject, 
      html: htmlContent,
    });
    console.log(`✅ Email sent to: ${to} | ID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    return false;
  }
}

// ── Test Email ──
async function sendTestEmail(toEmail) {
  const transporter = await getTransporter();
  const fromEmail = await getSenderEmail();
  
  if (!transporter || !fromEmail) { 
    console.log('⚠️ Email not configured.'); 
    return false; 
  }
  
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:10px;padding:30px;">
    <h2 style="color:#F59E0B;">✅ Email Configuration Successful!</h2>
    <p>Your Sai Lounge POS email is working correctly.</p>
    <hr>
    <h3>Configuration Details:</h3>
    <ul>
      <li><strong>Authentication:</strong> ${process.env.REFRESH_TOKEN ? 'OAuth2 (Gmail)' : 'SMTP'}</li>
      <li><strong>From Email:</strong> ${fromEmail}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    <p>Automatic reports will be sent to all Admin &amp; Management users.</p>
    <p style="font-size:12px;color:#666;margin-top:20px;">Sai Lounge POS System — Automated Test</p>
  </div>
</body>
</html>`;
  
  return await sendReport(toEmail || fromEmail, '✅ Sai Lounge POS — Email Test Successful!', html);
}

// ── Daily Report ──
async function generateDailyReport() {
  const today = new Date().toISOString().split('T')[0];
  
  const sales = await query(`SELECT 
    COUNT(*) as bill_count,
    COALESCE(SUM(total),0) as total_sales,
    COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) as cash_sales,
    COALESCE(SUM(CASE WHEN payment_method='mpesa' THEN total ELSE 0 END),0) as mpesa_sales,
    COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) as card_sales,
    COALESCE(SUM(discount),0) as total_discounts 
    FROM bills WHERE status='paid' AND date(paid_at)=?`, [today]);
  
  const topItems = await query(`SELECT 
    mi.name,
    SUM(oi.quantity) as qty_sold,
    SUM(oi.quantity*oi.unit_price) as revenue 
    FROM order_items oi 
    JOIN menu_items mi ON mi.id=oi.menu_item_id 
    JOIN orders o ON o.id=oi.order_id 
    JOIN bills b ON b.order_id=o.id 
    WHERE b.status='paid' AND date(b.paid_at)=? 
    GROUP BY mi.id ORDER BY revenue DESC LIMIT 10`, [today]);
  
  const categories = await query(`SELECT 
    mc.name as category,
    mc.department,
    SUM(oi.quantity*oi.unit_price) as revenue 
    FROM order_items oi 
    JOIN menu_items mi ON mi.id=oi.menu_item_id 
    JOIN menu_categories mc ON mc.id=mi.category_id 
    JOIN orders o ON o.id=oi.order_id 
    JOIN bills b ON b.order_id=o.id 
    WHERE b.status='paid' AND date(b.paid_at)=? 
    GROUP BY mc.id ORDER BY revenue DESC`, [today]);
  
  const reportDate = new Date(today + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;}
  .container{max-width:800px;margin:0 auto;background:white;border-radius:10px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:2px solid #F59E0B;padding-bottom:20px;margin-bottom:20px;}
  .logo{font-size:24px;font-weight:bold;}.logo span{color:#F59E0B;}
  .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin:20px 0;}
  .card{background:#FAFAF9;padding:15px;border-radius:8px;text-align:center;border:1px solid #E7E5E4;}
  .val{font-size:22px;font-weight:bold;color:#D97706;}
  table{width:100%;border-collapse:collapse;margin:10px 0;}
  th,td{padding:10px;text-align:left;border-bottom:1px solid #E7E5E4;}
  th{background:#FAFAF9;font-weight:bold;}
  .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #E7E5E4;font-size:12px;color:#999;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Sai <span>Lounge</span></div>
    <h2>Daily Sales Report</h2>
    <p>${reportDate}</p>
  </div>
  
  <div class="summary">
    <div class="card"><div>Total Sales</div><div class="val">${fmt(sales[0]?.total_sales)}</div></div>
    <div class="card"><div>Bills Issued</div><div class="val">${sales[0]?.bill_count||0}</div></div>
    <div class="card"><div>Average Bill</div><div class="val">${fmt((sales[0]?.total_sales||0)/(sales[0]?.bill_count||1))}</div></div>
    <div class="card"><div>Discounts</div><div class="val">${fmt(sales[0]?.total_discounts)}</div></div>
  </div>
  
  <h3>💰 Payment Breakdown</h3>
  <table>
    <tr><th>Method</th><th>Amount</th><th>%</th></tr>
    <tr><td style="color:#10B981">💵 Cash</td><td>${fmt(sales[0]?.cash_sales)}</td><td>${((sales[0]?.cash_sales||0)/(sales[0]?.total_sales||1)*100).toFixed(1)}%</td></tr>
    <tr><td style="color:#8B5CF6">📱 M-Pesa</td><td>${fmt(sales[0]?.mpesa_sales)}</td><td>${((sales[0]?.mpesa_sales||0)/(sales[0]?.total_sales||1)*100).toFixed(1)}%</td></tr>
    <tr><td style="color:#3B82F6">💳 Card/PDQ</td><td>${fmt(sales[0]?.card_sales)}</td><td>${((sales[0]?.card_sales||0)/(sales[0]?.total_sales||1)*100).toFixed(1)}%</td></tr>
  </table>
  
  <h3>🏆 Top Selling Items</h3>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Revenue</th></tr>
    ${topItems.map(i => `<tr><td>${i.name}</td><td>${i.qty_sold}</td><td style="color:#D97706">${fmt(i.revenue)}</td></tr>`).join('')}
    ${topItems.length === 0 ? '<tr><td colspan="3" style="color:#999;text-align:center">No sales today</td></tr>' : ''}
  </table>
  
  <h3>📊 Category Performance</h3>
  <table>
    <tr><th>Category</th><th>Dept</th><th>Revenue</th></tr>
    ${categories.map(c => `<tr><td>${c.category}</td><td>${c.department === 'bar' ? '🍸 Bar' : '🍳 Kitchen'}</td><td style="color:#D97706">${fmt(c.revenue)}</td></tr>`).join('')}
  </table>
  
  <div class="footer">
    <p>Automated report from Sai Lounge POS System</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
</div>
</body>
</html>`;
}

// ── Weekly Report ──
async function generateWeeklyReport() {
  const weeklyData = await query(`SELECT 
    date(paid_at) as date,
    COUNT(*) as bills,
    SUM(total) as sales 
    FROM bills WHERE status='paid' AND date(paid_at) >= date('now','-7 days') 
    GROUP BY date(paid_at) ORDER BY date ASC`);
  
  const total = weeklyData.reduce((s,d) => s + (d.sales || 0), 0);
  const bills = weeklyData.reduce((s,d) => s + (d.bills || 0), 0);
  const start = new Date(); 
  start.setDate(start.getDate() - 7);
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial;background:#f5f5f5;padding:20px;}
  .container{max-width:800px;margin:0 auto;background:white;border-radius:10px;padding:30px;}
  .header{text-align:center;border-bottom:2px solid #F59E0B;padding-bottom:20px;}
  .logo{font-size:24px;font-weight:bold;}.logo span{color:#F59E0B;}
  .summary{background:#FAFAF9;padding:15px;border-radius:8px;margin:20px 0;text-align:center;}
  .val{font-size:28px;font-weight:bold;color:#D97706;}
  table{width:100%;border-collapse:collapse;}
  th,td{padding:10px;border-bottom:1px solid #E7E5E4;text-align:left;}
  th{background:#FAFAF9;}
  .footer{text-align:center;font-size:12px;color:#999;margin-top:20px;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Sai <span>Lounge</span></div>
    <h2>Weekly Sales Report</h2>
    <p>${start.toLocaleDateString()} – ${new Date().toLocaleDateString()}</p>
  </div>
  
  <div class="summary">
    <div>Total Weekly Sales</div>
    <div class="val">${fmt(total)}</div>
    <div style="margin-top:8px;color:#666">Bills: ${bills} | Avg: ${fmt(total/(bills||1))}</div>
  </div>
  
  <h3>Daily Breakdown</h3>
  <table>
    <tr><th>Date</th><th>Bills</th><th>Sales</th></tr>
    ${weeklyData.map(d => `<tr><td>${d.date}</td><td>${d.bills}</td><td style="color:#D97706">${fmt(d.sales)}</td></tr>`).join('')}
    ${weeklyData.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#999">No data</td></tr>' : ''}
  </table>
  
  <div class="footer">
    <p>Sai Lounge POS — Automated Weekly Report | ${new Date().toLocaleString()}</p>
  </div>
</div>
</body>
</html>`;
}

// ── Monthly Report ──
async function generateMonthlyReport() {
  const d = await query(`SELECT 
    COUNT(*) as bills,
    SUM(total) as sales,
    SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END) as cash,
    SUM(CASE WHEN payment_method='mpesa' THEN total ELSE 0 END) as mpesa,
    SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END) as card,
    COALESCE(SUM(discount),0) as discounts 
    FROM bills WHERE status='paid' AND strftime('%Y-%m',paid_at)=strftime('%Y-%m','now')`);
  
  const top = await query(`SELECT 
    mi.name,
    SUM(oi.quantity) as qty_sold,
    SUM(oi.quantity*oi.unit_price) as revenue 
    FROM order_items oi 
    JOIN menu_items mi ON mi.id=oi.menu_item_id 
    JOIN orders o ON o.id=oi.order_id 
    JOIN bills b ON b.order_id=o.id 
    WHERE b.status='paid' AND strftime('%Y-%m',b.paid_at)=strftime('%Y-%m','now') 
    GROUP BY mi.id ORDER BY revenue DESC LIMIT 10`);
  
  const month = new Date().toLocaleString('default', {month: 'long', year: 'numeric'});
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial;background:#f5f5f5;padding:20px;}
  .container{max-width:800px;margin:0 auto;background:white;border-radius:10px;padding:30px;}
  .header{text-align:center;border-bottom:2px solid #F59E0B;padding-bottom:20px;}
  .logo{font-size:24px;font-weight:bold;}.logo span{color:#F59E0B;}
  .summary{background:#FAFAF9;padding:20px;border-radius:8px;margin:20px 0;text-align:center;}
  .val{font-size:32px;font-weight:bold;color:#D97706;}
  table{width:100%;border-collapse:collapse;margin:10px 0;}
  th,td{padding:10px;border-bottom:1px solid #E7E5E4;text-align:left;}
  th{background:#FAFAF9;}
  .footer{text-align:center;font-size:12px;color:#999;margin-top:20px;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Sai <span>Lounge</span></div>
    <h2>Monthly Sales Report</h2>
    <p>${month}</p>
  </div>
  
  <div class="summary">
    <div>Total Monthly Sales</div>
    <div class="val">${fmt(d[0]?.sales)}</div>
    <div style="margin-top:8px;color:#666">Bills: ${d[0]?.bills||0} | Discounts: ${fmt(d[0]?.discounts)}</div>
  </div>
  
  <h3>💰 Payment Breakdown</h3>
  <table>
    <tr><th>Method</th><th>Amount</th><th>%</th></tr>
    <tr><td style="color:#10B981">💵 Cash</td><td>${fmt(d[0]?.cash)}</td><td>${((d[0]?.cash||0)/(d[0]?.sales||1)*100).toFixed(1)}%</td></tr>
    <tr><td style="color:#8B5CF6">📱 M-Pesa</td><td>${fmt(d[0]?.mpesa)}</td><td>${((d[0]?.mpesa||0)/(d[0]?.sales||1)*100).toFixed(1)}%</td></tr>
    <tr><td style="color:#3B82F6">💳 Card</td><td>${fmt(d[0]?.card)}</td><td>${((d[0]?.card||0)/(d[0]?.sales||1)*100).toFixed(1)}%</td></tr>
  </table>
  
  <h3>🏆 Top Items This Month</h3>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Revenue</th></tr>
    ${top.map(i => `<tr><td>${i.name}</td><td>${i.qty_sold}</td><td style="color:#D97706">${fmt(i.revenue)}</td></tr>`).join('')}
    ${top.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#999">No data</td></tr>' : ''}
  </table>
  
  <div class="footer">
    <p>Sai Lounge POS — Automated Monthly Report | ${new Date().toLocaleString()}</p>
  </div>
</div>
</body>
</html>`;
}

// ── Scheduled Senders ──
async function sendDailyReport() {
  const recipients = await getAllReportRecipients();
  if (!recipients) { console.log('⚠️ No daily report recipients found.'); return false; }
  console.log(`📧 Sending daily report to: ${recipients}`);
  const html = await generateDailyReport();
  return await sendReport(recipients, `📊 Daily Sales Report – ${new Date().toLocaleDateString('en-KE')}`, html);
}

async function sendWeeklyReport() {
  const recipients = await getAllReportRecipients();
  if (!recipients) { console.log('⚠️ No weekly report recipients found.'); return false; }
  console.log(`📧 Sending weekly report to: ${recipients}`);
  const html = await generateWeeklyReport();
  return await sendReport(recipients, `📊 Weekly Sales Report – ${new Date().toLocaleDateString('en-KE')}`, html);
}

async function sendMonthlyReport() {
  const recipients = await getAllReportRecipients();
  if (!recipients) { console.log('⚠️ No monthly report recipients found.'); return false; }
  console.log(`📧 Sending monthly report to: ${recipients}`);
  const html = await generateMonthlyReport();
  return await sendReport(recipients, `📊 Monthly Sales Report – ${new Date().toLocaleString('default', {month: 'long', year: 'numeric'})}`, html);
}

module.exports = {
  sendDailyReport,
  sendWeeklyReport,
  sendMonthlyReport,
  sendReport,
  sendTestEmail,
  getAllReportRecipients,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
};