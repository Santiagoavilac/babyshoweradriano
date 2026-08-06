import { LISTA, getRedis, autorizado } from './_kv.js';

const ESTADOS = new Set(['sin_confirmar', 'confirmado', 'no_asiste']);

function limpiar(entrada) {
  const g = entrada && typeof entrada === 'object' ? entrada : {};
  return {
    name: String(g.name || 'Desconocido').slice(0, 80),
    status: ESTADOS.has(g.status) ? g.status : 'sin_confirmar',
    // Ausente significa "todavía no lo dije", y ahí el panel asume 1. Un 0 explícito se respeta.
    people: g.people === undefined ? 1 : Math.max(0, Math.min(999, Number(g.people) || 0)),
    notes: String(g.notes || '').slice(0, 300),
    manual: Boolean(g.manual),
  };
}

const idValido = (v) => typeof v === 'string' && /^[a-z0-9_-]{1,80}$/.test(v);

export default async function handler(req, res) {
  if (!autorizado(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Panel Adriano"');
    return res.status(401).json({ error: 'No autorizado' });
  }

  const redis = await getRedis();
  if (!redis) return res.status(501).json({ error: 'Base de datos no configurada' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }

  try {
    if (req.method === 'GET') {
      const guests = (await redis.hgetall(LISTA)) || {};
      return res.status(200).json({ guests });
    }

    // Un solo invitado: lo que dispara editar un campo en la tabla.
    if (req.method === 'POST') {
      if (!body || !idValido(body.id)) {
        return res.status(400).json({ error: 'Id inválido' });
      }
      await redis.hset(LISTA, { [body.id]: limpiar(body.guest) });
      return res.status(204).end();
    }

    // Reemplazo completo: importar un JSON o restaurar un respaldo.
    if (req.method === 'PUT') {
      const entrada = body && typeof body.guests === 'object' ? body.guests : null;
      if (!entrada) return res.status(400).json({ error: 'Falta guests' });

      const limpios = {};
      for (const [id, g] of Object.entries(entrada)) {
        if (idValido(id)) limpios[id] = limpiar(g);
      }

      await redis.del(LISTA);
      if (Object.keys(limpios).length) await redis.hset(LISTA, limpios);
      return res.status(204).end();
    }

    if (req.method === 'DELETE') {
      await redis.del(LISTA);
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch {
    return res.status(500).json({ error: 'No se pudo acceder a la lista' });
  }
}
