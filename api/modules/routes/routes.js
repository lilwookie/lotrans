const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const { requireRole } = require('../../middleware/requireRole');
const {
  addRoute,
  editRoute,
  listRoutes,
  getRoute, 
  removeRoute,
  addStopToRoute,
  editStop,
  listStops,
  removeStop,
  assignToRoute,
  getVehicleRoute,
  unassignFromRoute,
} = require('./controller');

router.use(authenticateJWT);
router.use(requireRole('admin'));

// Routes
router.post('/add', addRoute);
router.get('/getAllRoutes', listRoutes);
router.get('/getRoute/:id', getRoute);
router.put('/edit-route/:id', editRoute);
router.delete('/delete/:id', removeRoute);

// Stops
router.post('/add-stop/:id/stops', addStopToRoute);
router.get('/list-stops/:id', listStops);
router.put('/edit-stop/:stop_id', editStop);
router.delete('/delete-stop/:id/stops/:stop_id', removeStop);

// Vehicle → Route assignment
router.post('/vehicle/:id/assign', assignToRoute);
router.get('/vehicle/:id', getVehicleRoute);
router.post('/vehicle/:id/unassign', unassignFromRoute);

module.exports = router;