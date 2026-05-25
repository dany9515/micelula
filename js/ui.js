import { state } from './state.js';

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
  if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
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
