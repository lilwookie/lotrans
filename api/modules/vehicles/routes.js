const express = require('express');
const router = express.Router();
const authenticateJWT  = require('../../middleware/authenticateJWT');
const {requireRole}  = require('../../middleware/requireRole');
const {
  registerVehicle,
  listVehicles,
  getVehicle,
  editVehicle,
  removeVehicle,
} = require('./controller');

const {
  assignDriver,
  unassignDriver,
  getAssignment,
} = require('./assignement.controller');

// All vehicle routes require a logged-in admin
router.use(authenticateJWT);
router.use(requireRole('admin'));

router.post('/register', registerVehicle);
router.get('/getall', listVehicles);
router.get('/getById/:id', getVehicle);
router.put('/update/:id', editVehicle);
router.delete('/delete/:id', removeVehicle);

// Assignment routes
router.post('/assign/:id', assignDriver);
router.delete('/unassign/:id', unassignDriver);
router.get('/assignments/:id', getAssignment);

module.exports = router;