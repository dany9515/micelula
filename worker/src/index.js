// MiCélula: servidor del botón "Resetear contraseña" del panel de admin.
// Solo lo puede usar dani.admin (ADMIN_UID), y solo si confirmó su contraseña hace menos de 5 minutos.
// Habla con Google con la cuenta de servicio micelula-reset-claves, que solo puede buscar usuarios y cambiarles la contraseña.

import { PALABRAS } from './palabras.js';

const PROYECTO = 'micelula-cfcpn';
const DOMINIO_USUARIOS = 'micelula.operlog.com.ar';
const ORIGEN = 'https://micelula.operlog.com.ar';
const CONFIRMACION_MAX = 5 * 60; // segundos desde que dani.admin escribió su contraseña

export default {
  async fetch(req, env) {
    const cors = encabezadosCors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/resetear') return responder({ error: 'No encontrado' }, 404, cors);

    let quien;
    try {
      quien = await verificarTokenFirebase((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
    } catch {
      return responder({ error: 'Sesión no válida. Salí y volvé a entrar.' }, 401, cors);
    }
    if (quien.sub !== env.ADMIN_UID) return responder({ error: 'Sin permiso' }, 403, cors);
    if (Date.now() / 1000 - quien.auth_time > CONFIRMACION_MAX) return responder({ error: 'Confirmá tu contraseña de nuevo' }, 401, cors);

    let usuario = '';
    try { ({ usuario } = await req.json()); } catch {}
    usuario = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(usuario)) return responder({ error: 'Usuario inválido' }, 400, cors);

    try {
      const acceso = await tokenServicio(env);
      const { users } = await google(acceso, 'accounts:lookup', { email: [`${usuario}@${DOMINIO_USUARIOS}`] });
      const cuenta = users?.[0];
      if (!cuenta) return responder({ error: 'No existe ese usuario' }, 404, cors);
      if (cuenta.localId === env.ADMIN_UID) return responder({ error: 'Tu propia contraseña se cambia desde 🔑' }, 400, cors);
      const password = generica();
      await google(acceso, 'accounts:update', { localId: cuenta.localId, password });
      console.log(`Contraseña reseteada: ${usuario}`); // registro en Cloudflare (Workers → micelula-admin → Logs); nunca la contraseña
      return responder({ usuario, password }, 200, cors);
    } catch (e) {
      console.log('Error al resetear:', e.message);
      return responder({ error: 'No se pudo resetear. Probá de nuevo en un rato.' }, 502, cors);
    }
  },
};

// Solo la app (y la copia de prueba en la compu, mientras ORIGEN_PRUEBA tenga algo) pueden llamar desde el navegador.
function encabezadosCors(req, env) {
  const origen = req.headers.get('Origin');
  const permitidos = [ORIGEN, env.ORIGEN_PRUEBA].filter(Boolean);
  if (!permitidos.includes(origen)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function responder(datos, status, cors) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Contraseña genérica: dos palabras distintas al azar, por ejemplo "perro.paz".
function generica() {
  const a = alAzar(PALABRAS);
  let b;
  do b = alAzar(PALABRAS); while (b === a);
  return `${a}.${b}`;
}

// Elige al azar con el generador seguro, sin favorecer ninguna palabra.
function alAzar(lista) {
  const n = new Uint32Array(1);
  const tope = 2 ** 32 - (2 ** 32 % lista.length);
  do crypto.getRandomValues(n); while (n[0] >= tope);
  return lista[n[0] % lista.length];
}

// ---------- Token de Firebase de quien llama (firmado por Google) ----------

let llavesFirebase = null, llavesVencen = 0;

async function verificarTokenFirebase(jwt) {
  const [h64, p64, s64] = jwt.split('.');
  if (!s64) throw new Error('formato');
  const cabecera = JSON.parse(texto(desdeB64url(h64)));
  const p = JSON.parse(texto(desdeB64url(p64)));
  const ahora = Date.now() / 1000;
  if (cabecera.alg !== 'RS256') throw new Error('alg');
  if (p.iss !== `https://securetoken.google.com/${PROYECTO}` || p.aud !== PROYECTO || !p.sub) throw new Error('emisor');
  if (!(p.exp > ahora) || !(p.iat <= ahora + 60) || !(p.auth_time <= ahora + 60)) throw new Error('fechas');
  const jwk = (await llaves()).find(k => k.kid === cabecera.kid);
  if (!jwk) throw new Error('llave');
  const clave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, desdeB64url(s64), new TextEncoder().encode(`${h64}.${p64}`));
  if (!ok) throw new Error('firma');
  return p;
}

async function llaves() {
  if (llavesFirebase && Date.now() < llavesVencen) return llavesFirebase;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('llaves ' + r.status);
  const edad = Number((r.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  llavesFirebase = (await r.json()).keys;
  llavesVencen = Date.now() + edad * 1000;
  return llavesFirebase;
}

// ---------- Acceso a Google con la cuenta de servicio ----------

let accesoGoogle = null, accesoVence = 0;

async function tokenServicio(env) {
  if (accesoGoogle && Date.now() < accesoVence) return accesoGoogle;
  const ahora = Math.floor(Date.now() / 1000);
  const parte = o => aB64url(new TextEncoder().encode(JSON.stringify(o)));
  const sinFirma = parte({ alg: 'RS256', typ: 'JWT' }) + '.' + parte({
    iss: env.SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600,
  });
  const pem = env.SA_KEY.replace(/-----[^-]+-----/g, '').replace(/\\n|\s/g, '');
  const clave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', clave, new TextEncoder().encode(sinFirma)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${sinFirma}.${aB64url(firma)}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token de Google: ' + (j.error || r.status));
  accesoGoogle = j.access_token;
  accesoVence = Date.now() + (j.expires_in - 300) * 1000;
  return accesoGoogle;
}

async function google(acceso, metodo, cuerpo) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/${metodo}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${metodo}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ---------- base64url ----------

function desdeB64url(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

function aB64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const texto = bytes => new TextDecoder().decode(bytes);
