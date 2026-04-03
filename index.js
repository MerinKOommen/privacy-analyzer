require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware to check auth
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.redirect('/login');
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.redirect('/login');
    req.user = data.user;
    next();
  } catch(e) {
    res.redirect('/login');
  }
}

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

// Auth callback for Google OAuth
app.get('/auth-callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'auth-callback.html'));
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Dashboard (after login - free limited access)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Full analyzer (paid users only)
app.get('/analyzer', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'analyzer.html'));
});

// Success page after payment
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'success.html'));
});

// Admin login page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});

// Admin login check
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = Buffer.from(process.env.ADMIN_PASSWORD).toString('base64');
    res.json({ success: true, token });
  } else {
    res.json({ success: false, error: 'Wrong password' });
  }
});

// Admin dashboard
app.get('/admin-dashboard', (req, res) => {
  const token = req.query.token;
  const validToken = Buffer.from(process.env.ADMIN_PASSWORD).toString('base64');
  if (token === validToken) {
    res.sendFile(path.join(__dirname, 'views', 'analyzer.html'));
  } else {
    res.redirect('/admin');
  }
});

// Check if user has paid
app.post('/check-payment', async (req, res) => {
  const { userId } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('has_paid')
      .eq('id', userId)
      .single();
    if (error || !data) return res.json({ hasPaid: false });
    res.json({ hasPaid: data.has_paid });
  } catch (err) {
    res.json({ hasPaid: false });
  }
});

// Create Razorpay order
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 49900,
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark user as paid after successful payment
app.post('/payment-success', async (req, res) => {
  const { userId, email } = req.body;
  try {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        has_paid: true,
        paid_at: new Date().toISOString(),
      });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Chat endpoint - using Groq free API
app.post('/ai-chat', async (req, res) => {
  const { message, scanData } = req.body;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are a privacy and cybersecurity expert inside PrivacyAnalyzer app. Explain privacy risks in simple everyday language that non-technical people understand. Here is the user current scan data: IP: ${scanData?.ip}, Location: ${scanData?.location}, VPN: ${scanData?.vpn}, Score: ${scanData?.score}/100, Trackers found: ${scanData?.trackers}, WebRTC: ${scanData?.webrtc}, Browser: ${scanData?.browser}, Cookies: ${scanData?.cookies}. Keep responses short, simple and actionable. Use bullet points when listing things.`
          },
          { role: 'user', content: message }
        ]
      })
    });
    const data = await response.json();
    res.json({ reply: data.choices?.[0]?.message?.content || 'Sorry I could not process that.' });
  } catch(err) {
    res.status(500).json({ reply: 'Sorry I am having trouble. Please try again.' });
  }
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});