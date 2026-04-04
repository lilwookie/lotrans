const { getIO } = require('../../websocket/socket');
const {
  getDriverById,
  getVehicleById,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
  getActiveAssignment,
} = require('./assignment.model');

async function assignDriver(req, res) {
  const { id: vehicle_id } = req.params;
  const { driver_id } = req.body;

  if (!driver_id) {
    return res.status(400).json({ error: 'driver_id is required' });
  }

  const vehicle = await getVehicleById(vehicle_id);
  if (vehicle === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const driver = await getDriverById(driver_id);
  if (driver === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid driver ID' });
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const result = await assignDriverToVehicle(driver_id, vehicle_id);

  if (result === 'ALREADY_ASSIGNED') {
    return res.status(409).json({ error: 'Driver or vehicle is already in an active assignment' });
  }
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid ID' });

  // 🌍 Open broadcast — driver now has a vehicle
  getIO().emit('driver:assigned', {
    vehicle_id,
    driver_id,
    plate_number: vehicle.plate_number,
    driver_name: driver.full_name,
  });
  console.log(`[EMIT] driver:assigned → ${driver.full_name} → ${vehicle.plate_number}`);

  return res.status(201).json({ message: 'Driver assigned successfully', assignment: result });
}

async function unassignDriver(req, res) {
  const { id: vehicle_id } = req.params;

  const vehicle = await getVehicleById(vehicle_id);
  if (vehicle === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const result = await unassignDriverFromVehicle(vehicle_id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'No active assignment found for this vehicle' });

  // 🌍 Open broadcast — vehicle no longer has a driver
  getIO().emit('driver:unassigned', {
    vehicle_id,
    plate_number: vehicle.plate_number,
  });
  console.log(`[EMIT] driver:unassigned → ${vehicle.plate_number}`);

  return res.status(200).json({ message: 'Driver unassigned successfully', assignment: result });
}

async function getAssignment(req, res) {
  const { id: vehicle_id } = req.params;

  const result = await getActiveAssignment(vehicle_id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'No active assignment for this vehicle' });

  return res.status(200).json({ assignment: result });
}

module.exports = {
  assignDriver,
  unassignDriver,
  getAssignment,
};