import { KEY, getRedis } from './_kv.js';

const EVENTOS = new Set(['view', 'open', 'rsvp_click']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // sendBeacon manda un Blob; según el runtime puede llegar sin parsear
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Cuerpo inválido' });
  }

  const { event, slug, name } = body;
  if (!EVENTOS.has(event)) {
    return res.status(400).json({ error: 'Evento desconocido' });
  }

  const redis = await getRedis();
  if (!redis) {
    // Sin base configurada. El cliente ya guardó en localStorage.
    return res.status(501).json({ error: 'Base de datos no configurada' });
  }

  const id = String(slug || '_anonimo').slice(0, 80);

  try {
    const actual = (await redis.hget(KEY, id)) || {};
    const registro = typeof actual === 'string' ? JSON.parse(actual) : actual;

    registro.name = String(name || registro.name || 'Sin nombre').slice(0, 80);
    registro.views = (registro.views || 0) + (event === 'view' ? 1 : 0);
    if (event === 'open') registro.opened = true;
    if (event === 'rsvp_click') registro.rsvp = true;
    registro.lastEvent = event;
    registro.lastAt = new Date().toISOString();

    await redis.hset(KEY, { [id]: registro });
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo registrar el evento' });
  }
}
