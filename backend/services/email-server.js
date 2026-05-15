// email-server.js - Minimal server for email testing
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

app.get('/test-email', async (req, res) => {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI
    );

    oAuth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN
    });

    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken.token
      }
    });

    await transporter.sendMail({
      from: `"Sai POS" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: '✅ Email Test Successful!',
      text: 'Your OAuth2 email configuration is working!',
      html: '<h2>✅ Success!</h2><p>Your POS system can now send emails.</p>'
    });

    res.json({ success: true, message: 'Test email sent! Check your inbox.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Email server running', endpoints: ['/test-email'] });
});

app.listen(PORT, () => {
  console.log(`📧 Email test server running on http://localhost:${PORT}`);
  console.log(`👉 Test: http://localhost:${PORT}/test-email`);
});