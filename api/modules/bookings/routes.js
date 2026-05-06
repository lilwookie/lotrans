const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const { requireRole } = require('../../middleware/requireRole');
const {
  getAvailableVehicles,
  getStopsForVehicle,
  getFare,
  bookVehicle,
  myBookings,
  cancelMyBooking,
} = require('./controller');

// Public-ish — any logged in user can see available vehicles and stops
router.use(authenticateJWT);

router.get('/vehicles/available', getAvailableVehicles);
router.get('/stops/:vehicle_id', getStopsForVehicle);
router.get('/fare', getFare);

// Passenger only
router.post('/book/:passenger_id', requireRole('passenger'), bookVehicle);
router.get('/my', requireRole('passenger'), myBookings);
router.delete('/:id', requireRole('passenger'), cancelMyBooking);

module.exports = router;