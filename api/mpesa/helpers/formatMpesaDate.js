/**
 * Converts M-Pesa timestamp format (20240101120000) to ISO string
 * Example: 20240101120000 → 2024-01-01T12:00:00.000Z
 */
function formatMpesaTimestamp(raw) {
  if (!raw) return null;
  const str = String(raw);
  const year = str.slice(0, 4);
  const month = str.slice(4, 6);
  const day = str.slice(6, 8);
  const hour = str.slice(8, 10);
  const min = str.slice(10, 12);
  const sec = str.slice(12, 14);
  return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`).toISOString();
}

module.exports = { formatMpesaTimestamp };