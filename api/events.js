import { KEY, getKv, autorizado } from './_kv.js';

export default async function handler(req, res) {
  if (!autorizado(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Panel Adriano"');
    return res.status(401).json({ error: 'No autorizado' });
  }

  const kv = await getKv();
  if (!kv) {
    return res.status(501).json({ error: 'KV no configurado' });
  }

  if (req.method === 'GET') {
    try {
      const todos = (await kv.hgetall(KEY)) || {};
      const invitados = Object.entries(todos).map(([slug, valor]) => {
        const r = typeof valor === 'string' ? JSON.parse(valor) : valor;
        return {
          slug,
          name: r.name || slug,
          views: r.views || 0,
          opened: !!r.opened,
          rsvp: !!r.rsvp,
          lastEvent: r.lastEvent || null,
          lastAt: r.lastAt || null,
        };
      });
      return res.status(200).json({ invitados });
    } catch {
      return res.status(500).json({ error: 'No se pudieron leer los eventos' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await kv.del(KEY);
      return res.status(204).end();
    } catch {
      return res.status(500).json({ error: 'No se pudieron limpiar los datos' });
    }
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'Método no permitido' });
}
