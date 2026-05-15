// backend/services/emailService.js
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { query } = require('../models/database');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL_USER = process.env.EMAIL_USER;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Create OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendEmail(to, subject, htmlContent) {
  try {
    const accessToken = await oAuth2Client.getAccessToken();
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: EMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });
    
    const mailOptions = {
      from: `"Sai Lounge POS" <${EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
}

async function sendReport(recipients, subject, htmlContent) {
  const emailList = recipients.split(',').map(e => e.trim());
  let allSuccess = true;
  
  for (const email of emailList) {
    const success = await sendEmail(email, subject, htmlContent);
    if (!success) allSuccess = false;
  }
  
  return allSuccess;
}

function fmt(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

async function generateDailyReport() {
  const today = new Date().toISOString().split('T')[0];
  
  const sales = await query(`
    SELECT 
      COUNT(*) as bill_count,
      COALESCE(SUM(total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total ELSE 0 END), 0) as mpesa_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales
    FROM bills 
    WHERE status = 'paid' AND date(paid_at) = ?
  `, [today]);
  
  const topItems = await query(`
    SELECT mi.name, SUM(oi.quantity) as qty_sold, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    JOIN orders o ON o.id = oi.order_id
    JOIN bills b ON b.order_id = o.id
    WHERE b.status = 'paid' AND date(b.paid_at) = ?
    GROUP BY mi.id
    ORDER BY revenue DESC
    LIMIT 10
  `, [today]);
  
  const reportDate = new Date(today).toLocaleDateString();
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Daily Sales Report</title>
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 10px; padding: 25px; }
  .header { text-align: center; border-bottom: 2px solid #F59E0B; padding-bottom: 15px; }
  .logo { font-size: 22px; font-weight: bold; }
  .logo span { color: #F59E0B; }
  .summary { display: flex; justify-content: space-around; margin: 20px 0; }
  .summary-card { background: #FAFAF9; padding: 12px 20px; border-radius: 8px; text-align: center; }
  .summary-value { font-size: 20px; font-weight: bold; color: #D97706; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { padding: 8px; text-align: left; border-bottom: 1px solid #E7E5E4; }
  th { background: #FAFAF9; }
  .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Sai <span>Lounge</span></div>
    <h3>Daily Sales Report</h3>
    <p>${reportDate}</p>
  </div>
  
  <div class="summary">
    <div class="summary-card"><div>Total Sales</div><div class="summary-value">${fmt(sales[0]?.total_sales || 0)}</div></div>
    <div class="summary-card"><div>Bills</div><div class="summary-value">${sales[0]?.bill_count || 0}</div></div>
    <div class="summary-card"><div>Average</div><div class="summary-value">${fmt((sales[0]?.total_sales || 0) / (sales[0]?.bill_count || 1))}</div></div>
  </div>
  
  <h4>Payment Breakdown</h4>
  <table>
    <tr><th>Method</th><th>Amount</th></tr>
    <tr><td>💵 Cash</td><td>${fmt(sales[0]?.cash_sales || 0)}</td></tr>
    <tr><td>📱 M-Pesa</td><td>${fmt(sales[0]?.mpesa_sales || 0)}</td></tr>
    <tr><td>💳 Card</td><td>${fmt(sales[0]?.card_sales || 0)}</td></tr>
  </table>
  
  <h4>Top Selling Items</h4>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Revenue</th></tr>
    ${topItems.map(i => `<tr><td>${i.name}</td><td>${i.qty_sold}</td><td>${fmt(i.revenue)}</td></tr>`).join('')}
  </td>
  
  <div class="footer"><p>Sai Lounge POS - Automated Report</p></div>
</div>
</body>
</html>`;
}

async function sendDailyReport() {
  const settings = await query("SELECT * FROM email_settings LIMIT 1");
  if (!settings.length || !settings[0].send_daily_report || !settings[0].report_emails) {
    console.log('Daily reports not configured');
    return false;
  }
  const html = await generateDailyReport();
  return await sendReport(settings[0].report_emails, `Daily Sales Report - ${new Date().toLocaleDateString()}`, html);
}

async function sendWeeklyReport() {
  const settings = await query("SELECT * FROM email_settings LIMIT 1");
  if (!settings.length || !settings[0].send_weekly_report || !settings[0].report_emails) return false;
  
  const weeklyData = await query(`
    SELECT date(paid_at) as date, COUNT(*) as bills, SUM(total) as sales
    FROM bills WHERE status='paid' AND date(paid_at) >= date('now', '-7 days')
    GROUP BY date(paid_at) ORDER BY date ASC
  `);
  
  const totalSales = weeklyData.reduce((sum, d) => sum + d.sales, 0);
  const totalBills = weeklyData.reduce((sum, d) => sum + d.bills, 0);
  
  const html = `<!DOCTYPE html>
<html>
<head><title>Weekly Report</title></head>
<body style="font-family: Arial;">
  <h2>Sai Lounge - Weekly Sales Report</h2>
  <p>Week ending: ${new Date().toLocaleDateString()}</p>
  <table border="1" cellpadding="8" style="border-collapse: collapse;">
    <tr><th>Date</th><th>Bills</th><th>Sales</th></tr>
    ${weeklyData.map(d => `<tr><td>${d.date}</td><td>${d.bills}</td><td>${fmt(d.sales)}</td></tr>`).join('')}
  </table>
  <p><strong>Total Sales: ${fmt(totalSales)}</strong></p>
  <p><strong>Total Bills: ${totalBills}</strong></p>
  <p><strong>Average Bill: ${fmt(totalSales / (totalBills || 1))}</strong></p>
</body>
</html>`;
  
  return await sendReport(settings[0].report_emails, `Weekly Sales Report`, html);
}

async function sendMonthlyReport() {
  const settings = await query("SELECT * FROM email_settings LIMIT 1");
  if (!settings.length || !settings[0].send_monthly_report || !settings[0].report_emails) return false;
  
  const monthlyData = await query(`
    SELECT COUNT(*) as bills, SUM(total) as sales,
           SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END) as cash,
           SUM(CASE WHEN payment_method='mpesa' THEN total ELSE 0 END) as mpesa,
           SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END) as card
    FROM bills WHERE status='paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')
  `);
  
  const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  
  const html = `<!DOCTYPE html>
<html>
<head><title>Monthly Report</title></head>
<body style="font-family: Arial;">
  <h2>Sai Lounge - Monthly Sales Report</h2>
  <h3>${monthName}</h3>
  <p><strong>Total Sales:</strong> ${fmt(monthlyData[0]?.sales || 0)}</p>
  <p><strong>Total Bills:</strong> ${monthlyData[0]?.bills || 0}</p>
  <p><strong>Cash Sales:</strong> ${fmt(monthlyData[0]?.cash || 0)}</p>
  <p><strong>M-Pesa Sales:</strong> ${fmt(monthlyData[0]?.mpesa || 0)}</p>
  <p><strong>Card Sales:</strong> ${fmt(monthlyData[0]?.card || 0)}</p>
  <hr>
  <p style="font-size: 12px; color: #666;">Sai Lounge POS System</p>
</body>
</html>`;
  
  return await sendReport(settings[0].report_emails, `Monthly Sales Report - ${monthName}`, html);
}

module.exports = { sendDailyReport, sendWeeklyReport, sendMonthlyReport, sendReport };