const axios = require('axios');
const getToken = require('../helpers/getToken');
const { formatMpesaTimestamp } = require('../helpers/formatMpesaDate');
const { getIO } = require('../../websocket/socket');
const {
  createTransaction,
  updateTransaction,
  getTransactionByCheckoutId,
  updateBookingPaymentStatus,
} = require('./model');

//get authentication token from mpesa
async function getOAuthToken(req, res) {
  try {
    const token = await getToken();
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get token', error: err.message });
  }
}

/**
 * Initiate STK Push
 * Called internally from booking controller — not a direct route
 */
async function initiateStkPush({ phone, amount, booking_id, passenger_id }) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  // Get fresh token
  const accessToken = await getToken();

  // Build timestamp & password
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const stkPayload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount), // M-Pesa requires integer
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: `LOTRANS-${booking_id.slice(0, 8).toUpperCase()}`,
    TransactionDesc: 'LoTrans Bus Fare',
  };

  console.log('📤 STK Payload:', stkPayload);

  const stkUrl = `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`;
  const stkRes = await axios.post(stkUrl, stkPayload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('📥 STK Push Response:', stkRes.data);

  const { MerchantRequestID, CheckoutRequestID } = stkRes.data;

  // Save transaction to DB
  await createTransaction({
    booking_id,
    passenger_id,
    merchant_request_id: MerchantRequestID,
    checkout_request_id: CheckoutRequestID,
    amount,
    phone_number: phone,
  });

  // Update booking with checkout ID
  await updateBookingPaymentStatus(booking_id, 'pending', CheckoutRequestID);

  return { MerchantRequestID, CheckoutRequestID };
}

/**
 * M-Pesa Callback — Safaricom calls this after payment
 */
async function handleMpesaCallback(req, res) {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) return res.status(400).send('Invalid callback data');

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    console.log('📲 STK Callback received:', JSON.stringify(stkCallback, null, 2));

    let mpesa_receipt = null;
    let amount = null;
    let transaction_date = null;
    let phone_number = null;

    if (CallbackMetadata) {
      for (const item of CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber': mpesa_receipt = item.Value; break;
          case 'Amount': amount = item.Value; break;
          case 'PhoneNumber': phone_number = item.Value; break;
          case 'TransactionDate': transaction_date = formatMpesaTimestamp(item.Value); break;
        }
      }
    }

    // Update transaction record
    const transaction = await updateTransaction(CheckoutRequestID, {
      mpesa_receipt,
      amount,
      transaction_date,
      phone_number,
      result_code: ResultCode,
      result_desc: ResultDesc,
      callback_response: JSON.stringify(stkCallback),
    });

    if (!transaction) {
      console.error('Transaction not found for CheckoutRequestID:', CheckoutRequestID);
      return res.status(404).send('Transaction not found');
    }

    // Determine payment status
    const payment_status = ResultCode === 0 ? 'paid' : 'failed';

    // Update booking payment status
    if (transaction.booking_id) {
      await updateBookingPaymentStatus(transaction.booking_id, payment_status, CheckoutRequestID);
    }

    // Map result codes to messages
    const statusMessages = {
      0: 'Payment successful',
      1: 'Insufficient balance',
      1032: 'Request cancelled by user',
      1037: 'User cancelled the transaction',
      1001: 'Request could not be processed',
    };
    const statusMessage = statusMessages[ResultCode] || 'Unknown status';

    // 🌍 Emit payment status to passenger
    getIO().to(`passenger:${transaction.passenger_id}`).emit('payment:status', {
      status: statusMessage,
      result_code: ResultCode,
      result_desc: ResultDesc,
      checkout_request_id: CheckoutRequestID,
      payment_status,
      metadata: {
        amount,
        receipt: mpesa_receipt,
        phone: phone_number,
        transaction_date,
      },
    });
    console.log(`[EMIT] payment:status → passenger:${transaction.passenger_id} | ${statusMessage}`);

    // Also notify admin dashboard
    getIO().to('admin:dashboard').emit('payment:received', {
      booking_id: transaction.booking_id,
      payment_status,
      amount,
      receipt: mpesa_receipt,
      phone: phone_number,
    });
    console.log(`[EMIT] payment:received → admin:dashboard | ${payment_status}`);

    res.status(200).send('Callback received');
  } catch (err) {
    console.error('❌ Callback error:', err.message);
    res.status(500).send('Internal server error');
  }
}

/**
 * Check payment status manually
 */
async function checkPaymentStatus(req, res) {
  const { checkout_request_id } = req.params;

  const transaction = await getTransactionByCheckoutId(checkout_request_id);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

  const statusMessages = {
    0: 'Payment successful',
    1: 'Insufficient balance',
    1032: 'Request cancelled by user',
    1037: 'User cancelled the transaction',
    1001: 'Request could not be processed',
  };

  const statusMessage = transaction.result_code !== null
    ? statusMessages[transaction.result_code] || 'Unknown status'
    : 'Pending';

  return res.status(200).json({
    status: statusMessage,
    transaction,
  });
}

module.exports = {
  getOAuthToken,
  initiateStkPush,
  handleMpesaCallback,
  checkPaymentStatus,
};