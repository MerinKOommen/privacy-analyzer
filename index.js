require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const path = require('path');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Home page - landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

// Privacy analyzer page (protected)
app.get('/analyzer', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'analyzer.html'));
});

// Success page after payment
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'success.html'));
});

// Create Razorpay order
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 49900, // ₹499 in paise
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});