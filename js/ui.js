import { state } from './state.js';

export function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Usuarios: el líder escribe solo "moni.lider"; Firebase necesita un correo, así que se completa acá.
// 2026-10-18: antes era @micelula.com, un dominio ajeno que recibe correo (riesgo de "olvidé mi contraseña").
// micelula.operlog.com.ar es nuestro y no recibe correo.
export const DOMINIO_USUARIOS = 'micelula.operlog.com.ar';
export const DOMINIOS_VIEJOS = ['micelula.com', 'miceula.com'];

export function usuarioAEmail(usuario) {
  const u = String(usuario ?? '').trim().toLowerCase();
  const [local, dom] = u.split('@');
  return (!dom || DOMINIOS_VIEJOS.includes(dom)) ? local + '@' + DOMINIO_USUARIOS : u;
}

export function usuarioCorto(email) {
  const [local, dom] = String(email ?? '').split('@');
  return (dom === DOMINIO_USUARIOS || DOMINIOS_VIEJOS.includes(dom)) ? local : String(email ?? '');
}

// Números que vienen de Firestore (ofrenda, asistentes): si no es un número, 0. Nunca texto al HTML.
export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

let _confirmResolve = null;

export function confirmar(titulo, mensaje, btnTexto = '✔ Confirmar', isDanger = false) {
  document.getElementById('confirm-titulo').textContent = titulo;
  document.getElementById('confirm-msg').textContent = mensaje;
  const okBtn = document.getElementById('confirm-ok');
  okBtn.textContent = btnTexto;
  okBtn.style.background = isDanger ? 'linear-gradient(135deg,#c0392b,#922b21)' : '';
  okBtn.style.color = isDanger ? '#fff' : '';
  document.getElementById('modal-confirm').classList.add('show');
  return new Promise(resolve => { _confirmResolve = resolve; });
}

window.cerrarConfirm = function(resultado) {
  document.getElementById('modal-confirm').classList.remove('show');
  if (_confirmResolve) { _confirmResolve(resultado); _confirmResolve = null; }
};

export function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

export function formatFecha(f) {
  if (!f) return '—';
  const parts = String(f).split('T')[0].split('-');
  if (parts.length === 3) return escHtml(parts[2] + '/' + parts[1] + '/' + parts[0]);
  const d = new Date(f);
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

export function actualizarStats() {
  if (!state.usuarioActual) return;
  if (state.usuarioActual.rol === 'admin' || !state.miCelulaId) {
    document.getElementById('stat-miembros').textContent = '—';
    document.getElementById('stat-reuniones').textContent = '—';
    return;
  }
  document.getElementById('stat-miembros').textContent = state.miembrosCache.length;
  const mesActual = new Date().getMonth();
  const reuMes = state.reunionesCache.filter(r => r.fecha && new Date(r.fecha).getMonth() === mesActual).length;
  document.getElementById('stat-reuniones').textContent = reuMes;
}
