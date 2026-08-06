export const KEY = 'bsa:guests';   // tracking automático, lo escribe la invitación
export const LISTA = 'bsa:lista';  // lista maestra y estado manual, lo escribe el panel

export const CREDENCIALES = {
  usuario: process.env.ADMIN_USER || 'adriano',
  clave: process.env.ADMIN_PASS || 'adriano',
};

// Devuelve el cliente Redis, o null si el proyecto no tiene base configurada.
// En ese caso el frontend cae a localStorage.
// Los dos juegos de nombres existen: la integración de Upstash inyecta UPSTASH_*,
// y los proyectos que vienen del viejo Vercel KV siguen teniendo KV_*.
export async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

function seguraIgual(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export function autorizado(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }

  const sep = decoded.indexOf(':');
  if (sep === -1) return false;

  const usuario = decoded.slice(0, sep);
  const clave = decoded.slice(sep + 1);

  return seguraIgual(usuario, CREDENCIALES.usuario) && seguraIgual(clave, CREDENCIALES.clave);
}
