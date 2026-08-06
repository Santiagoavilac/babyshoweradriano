export const KEY = 'bsa:guests';

export const CREDENCIALES = {
  usuario: process.env.ADMIN_USER || 'adriano',
  clave: process.env.ADMIN_PASS || 'adriano',
};

// Devuelve el cliente KV, o null si el proyecto no tiene KV configurado.
// En ese caso el frontend cae a localStorage.
export async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
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
