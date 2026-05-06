const axios = require('axios');

async function getToken() {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const response = await axios.get(url, {
      auth: { username: consumerKey, password: consumerSecret },
    });

    const token = response.data?.access_token;
    if (!token) throw new Error('No access_token returned from Safaricom');

    console.log('✅ Fresh OAuth Token:', token);
    return token;
  } catch (err) {
    console.error('❌ Error fetching access token:', err.response?.data || err.message);
    throw new Error('Failed to get access token');
  }
}

module.exports = getToken;