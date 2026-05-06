const pool = require('../../config/db');

async function createTransaction({ booking_id, passenger_id, merchant_request_id, checkout_request_id, amount, phone_number }) {
  const result = await pool.query(
    `INSERT INTO mpesa_transactions 
      (booking_id, passenger_id, merchant_request_id, checkout_request_id, amount, phone_number)
     VALUES ($1, $2, $3, $4, $5::numeric, $6)
     RETURNING *`,
    [booking_id, passenger_id, merchant_request_id, checkout_request_id, amount, phone_number]
  );
  return result.rows[0];
}

async function updateTransaction(checkout_request_id, { mpesa_receipt, amount, transaction_date, phone_number, result_code, result_desc, callback_response }) {
  const result = await pool.query(
    `UPDATE mpesa_transactions
     SET mpesa_receipt = $1, amount = $2, transaction_date = $3,
         phone_number = $4, result_code = $5, result_desc = $6,
         callback_response = $7, updated_at = NOW()
     WHERE checkout_request_id = $8
     RETURNING *`,
    [mpesa_receipt, amount, transaction_date, phone_number, result_code, result_desc, callback_response, checkout_request_id]
  );
  return result.rows[0] || null;
}

async function getTransactionByCheckoutId(checkout_request_id) {
  const result = await pool.query(
    `SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1`,
    [checkout_request_id]
  );
  return result.rows[0] || null;
}

async function updateBookingPaymentStatus(booking_id, payment_status, mpesa_checkout_id) {
  await pool.query(
    `UPDATE bookings 
     SET payment_status = $1, mpesa_checkout_id = $2, 
         status = CASE WHEN $1 = 'paid' THEN 'confirmed' ELSE status END,
         updated_at = NOW()
     WHERE id = $3`,
    [payment_status, mpesa_checkout_id, booking_id]
  );
}

module.exports = {
  createTransaction,
  updateTransaction,
  getTransactionByCheckoutId,
  updateBookingPaymentStatus,
};