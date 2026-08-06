import { LISTA, getRedis } from './_kv.js';

// Público a propósito: la invitación necesita saludar al invitado por su nombre,
// pero el nombre no puede viajar en la URL (quedaría en la vista previa de
// WhatsApp). Acá se cambia un código opaco por un solo nombre — nunca la lista
// entera, que sigue detrás del Basic Auth de /api/guests.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const id = String(req.query.id || '').toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(id)) return res.status(400).json({ error: 'Código inválido' });

  const redis = await getRedis();
  if (!redis) return res.status(200).json({ name: null });

  const guest = await redis.hget(LISTA, id);
  const name = guest && typeof guest === 'object' ? guest.name : null;

  // Sin cache: si corregís un nombre en el panel, el invitado lo ve al recargar.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ name: name || null });
}
