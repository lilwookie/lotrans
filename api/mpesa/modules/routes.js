const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const {
  handleMpesaCallback,
  checkPaymentStatus,
  getOAuthToken,
} = require('./controller');

// Get OAuth token — for testing only
router.get('/token', authenticateJWT, getOAuthToken);

// Safaricom calls these — no auth needed
router.post('/callback', handleMpesaCallback);
router.post('/validation', (req, res) => {
  console.log('✅ Validation received:', req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
router.post('/confirmation', (req, res) => {
  console.log('✅ Confirmation received:', req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Check transaction status
router.get('/status/:checkout_request_id', authenticateJWT, checkPaymentStatus);

module.exports = router;