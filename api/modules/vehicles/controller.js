const { getIO } = require('../../websocket/socket');
const {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} = require('./model');

async function registerVehicle(req, res) {
  const { plate_number, make, model, year, capacity, vehicle_type, nickname } = req.body;

  if (!plate_number || !make || !model || !year || !capacity || !vehicle_type) {
    return res.status(400).json({ error: 'plate_number, make, model, year, capacity, and vehicle_type are required' });
  }

  const result = await createVehicle({ plate_number, make, model, year, capacity, vehicle_type, nickname });

  if (result === 'DUPLICATE_PLATE') return res.status(409).json({ error: 'A vehicle with that plate number already exists' });
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid ID' });

  // 🌍 Open broadcast — new vehicle in the fleet
  getIO().emit('vehicle:registered', { vehicle: result });
  console.log(`[EMIT] vehicle:registered → ${result.plate_number}`);

  return res.status(201).json({ message: 'Vehicle registered successfully', vehicle: result });
}

async function listVehicles(req, res) {
  const vehicles = await getAllVehicles();
  return res.status(200).json({ vehicles });
}

async function getVehicle(req, res) {
  const { id } = req.params;
  const result = await getVehicleById(id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'Vehicle not found' });

  return res.status(200).json({ vehicle: result });
}

async function editVehicle(req, res) {
  const { id } = req.params;
  const result = await updateVehicle(id, req.body);

  if (result === 'NO_FIELDS') return res.status(400).json({ error: 'No valid fields provided to update' });
  if (result === 'DUPLICATE_PLATE') return res.status(409).json({ error: 'A vehicle with that plate number already exists' });
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'Vehicle not found' });

  // Admin only — vehicle detail update
  getIO().to('admin:dashboard').emit('vehicle:updated', { vehicle: result });
  console.log(`[EMIT] vehicle:updated → ${result.plate_number}`);

  return res.status(200).json({ message: 'Vehicle updated successfully', vehicle: result });
}

async function removeVehicle(req, res) {
  const { id } = req.params;
  const result = await deleteVehicle(id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'Vehicle not found' });

  // 🌍 Open broadcast — vehicle removed from fleet, remove from map
  getIO().emit('vehicle:removed', { vehicle_id: id });
  console.log(`[EMIT] vehicle:removed → ${id}`);

  return res.status(200).json({ message: 'Vehicle removed successfully' });
}

module.exports = {
  registerVehicle,
  listVehicles,
  getVehicle,
  editVehicle,
  removeVehicle,
};