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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});