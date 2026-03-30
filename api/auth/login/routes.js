const express = require('express');
const router = express.Router();
const { handleLogin, handleRefreshToken } = require('./controller');

router.post('/login', handleLogin);
router.post('/refresh-token', handleRefreshToken);

module.exports = router;