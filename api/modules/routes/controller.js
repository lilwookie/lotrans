const { getIO } = require('../../websocket/socket');
const {
  createRoute,
  updateRoute,
  getAllRoutes,
  getRouteById,
  getRouteWithStops,
  deleteRoute,
  addStop,
  updateStop,
  getStopsByRoute,
  deleteStop,
  assignVehicleToRoute,
  getActiveVehicleRoute,
  unassignVehicleFromRoute,
} = require('./model');

// --- ROUTES ---

async function addRoute(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Route name is required' });

  const result = await createRoute(name);
  if (result === 'DUPLICATE_ROUTE') return res.status(409).json({ error: 'A route with that name already exists' });

  getIO().to('admin:dashboard').emit('route:created', { route: result });
  console.log(`[EMIT] route:created → ${result.name}`);

  return res.status(201).json({ message: 'Route created', route: result });
}

async function editRoute(req, res) {
  const { id } = req.params;
  const result = await updateRoute(id, req.body);

  if (result === 'NO_FIELDS') return res.status(400).json({ error: 'No valid fields provided' });
  if (result === 'DUPLICATE_ROUTE') return res.status(409).json({ error: 'Route name already exists' });
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });
  if (!result) return res.status(404).json({ error: 'Route not found' });

  getIO().to('admin:dashboard').emit('route:updated', { route: result });
  console.log(`[EMIT] route:updated → ${result.name}`);

  return res.status(200).json({ message: 'Route updated', route: result });
}

async function listRoutes(req, res) {
  const routes = await getAllRoutes();
  return res.status(200).json({ routes });
}

async function getRoute(req, res) {
  const { id } = req.params;
  const result = await getRouteWithStops(id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });
  if (!result) return res.status(404).json({ error: 'Route not found' });

  return res.status(200).json({ route: result });
}

async function removeRoute(req, res) {
  const { id } = req.params;
  const result = await deleteRoute(id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });
  if (!result) return res.status(404).json({ error: 'Route not found' });

  getIO().to('admin:dashboard').emit('route:deleted', { route_id: id });
  console.log(`[EMIT] route:deleted → ${id}`);

  return res.status(200).json({ message: 'Route deleted' });
}

// --- STOPS ---

async function addStopToRoute(req, res) {
  const { id: route_id } = req.params;
  const { name, stop_order, lat, lng, inbound_fare_peak, inbound_fare_offpeak, outbound_fare_peak, outbound_fare_offpeak } = req.body;

  if (!name || !stop_order) return res.status(400).json({ error: 'name and stop_order are required' });

  const route = await getRouteById(route_id);
  if (route === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });
  if (!route) return res.status(404).json({ error: 'Route not found' });

  const result = await addStop(route_id, { name, stop_order, lat, lng, inbound_fare_peak, inbound_fare_offpeak, outbound_fare_peak, outbound_fare_offpeak });
  if (result === 'DUPLICATE_STOP') return res.status(409).json({ error: 'Stop with that name or order already exists on this route' });
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });

  getIO().to('admin:dashboard').emit('stop:created', { stop: result });
  console.log(`[EMIT] stop:created → ${result.name} on route ${route_id}`);

  return res.status(201).json({ message: 'Stop added', stop: result });
}

async function editStop(req, res) {
  const { stop_id } = req.params;
  const result = await updateStop(stop_id, req.body);

  if (result === 'NO_FIELDS') return res.status(400).json({ error: 'No valid fields provided' });
  if (result === 'DUPLICATE_STOP') return res.status(409).json({ error: 'Stop name or order already exists on this route' });
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid stop ID' });
  if (!result) return res.status(404).json({ error: 'Stop not found' });

  getIO().to('admin:dashboard').emit('stop:updated', { stop: result });
  console.log(`[EMIT] stop:updated → ${result.name}`);

  return res.status(200).json({ message: 'Stop updated', stop: result });
}

async function listStops(req, res) {
  const { id: route_id } = req.params;
  const result = await getStopsByRoute(route_id);
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });
  return res.status(200).json({ stops: result });
}

async function removeStop(req, res) {
  const { stop_id } = req.params;
  const result = await deleteStop(stop_id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid stop ID' });
  if (!result) return res.status(404).json({ error: 'Stop not found' });

  getIO().to('admin:dashboard').emit('stop:deleted', { stop_id });
  console.log(`[EMIT] stop:deleted → ${stop_id}`);

  return res.status(200).json({ message: 'Stop removed' });
}

// --- VEHICLE ROUTE ASSIGNMENT ---

async function assignToRoute(req, res) {
  const { id: vehicle_id } = req.params;
  const { route_id } = req.body;

  if (!route_id) return res.status(400).json({ error: 'route_id is required' });

  const route = await getRouteById(route_id);
  if (route === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid route ID' });
  if (!route) return res.status(404).json({ error: 'Route not found' });

  const result = await assignVehicleToRoute(vehicle_id, route_id);
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });

  getIO().emit('vehicle:route:assigned', {
    vehicle_id,
    route_id,
    route_name: route.name,
  });
  console.log(`[EMIT] vehicle:route:assigned → vehicle:${vehicle_id} | ${route.name}`);

  return res.status(201).json({ message: `Vehicle assigned to ${route.name}`, assignment: result });
}

async function getVehicleRoute(req, res) {
  const { id: vehicle_id } = req.params;
  const result = await getActiveVehicleRoute(vehicle_id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'No active route for this vehicle' });

  return res.status(200).json({ route: result });
}

async function unassignFromRoute(req, res) {
  const { id: vehicle_id } = req.params;
  const result = await unassignVehicleFromRoute(vehicle_id);

  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!result) return res.status(404).json({ error: 'No active route assignment for this vehicle' });

  // 🌍 Open broadcast — vehicle no longer on a route
  getIO().emit('vehicle:route:unassigned', { vehicle_id });
  console.log(`[EMIT] vehicle:route:unassigned → vehicle:${vehicle_id}`);

  return res.status(200).json({ message: 'Vehicle unassigned from route' });
}

module.exports = {
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
};