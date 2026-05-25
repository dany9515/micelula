import { db, collection, addDoc, query, where, onSnapshot, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast, formatFecha, actualizarStats } from './ui.js';

export function suscribirReuniones() {
  if (state.unsubReuniones) { state.unsubReuniones(); state.unsubReuniones = null; }
  state.reunionesCache = [];
  state.reunionesShown = 10;
  if (!state.miCelulaId || state.miCelulaId === 'admin') return;
  const q = query(collection(db, 'reuniones'), where('celulaId', '==', state.miCelulaId));
  state.unsubReuniones = onSnapshot(q, snap => {
    state.reunionesCache = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    renderHistorial();
    actualizarStats();
  });
}

export function renderHistorial() {
  const cont = document.getElementById('historial-list');
  if (state.reunionesCache.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">📋</div><div>Aún no hay reuniones registradas.</div></div>';
    return;
  }
  const visibles = state.reunionesCache.slice(0, state.reunionesShown);
  const restantes = state.reunionesCache.length - state.reunionesShown;
  cont.innerHTML = visibles.map(r => `
    <div class="item-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-light);font-weight:700">📅 ${formatFecha(r.fecha)} ${r.hora ? '— ' + r.hora + 'hs' : ''}</div>
          ${r.lugar ? `<div class="item-info" style="margin-top:4px">📍 ${r.lugar}</div>` : ''}
        </div>
        <div class="cat-tag">${r.cantAsistentes || 0} asistentes</div>
      </div>
      ${r.tema ? `<div style="background:rgba(212,164,74,0.08);padding:8px 10px;border-radius:6px;margin-bottom:8px"><strong style="color:var(--gold-light)">📖 Tema:</strong> ${r.tema}</div>` : ''}
      ${r.ofrenda > 0 ? `<div class="item-info">💰 Ofrenda: $${r.ofrenda.toLocaleString('es-AR')}</div>` : ''}
      ${r.visitas ? `<div class="item-info">👋 Visitas: ${r.visitas}</div>` : ''}
      ${r.asistentesNombres && r.asistentesNombres.length ? `<div class="item-info" style="margin-top:6px">✓ ${r.asistentesNombres.join(', ')}</div>` : ''}
      ${r.obs ? `<div class="item-info" style="margin-top:8px;font-style:italic;background:rgba(30,58,95,0.15);padding:8px 10px;border-radius:6px">"${r.obs}"</div>` : ''}
    </div>
  `).join('') + (restantes > 0 ? `<button class="btn-secondary" onclick="verMasReuniones()" style="margin-top:4px">Ver ${restantes} reunión${restantes !== 1 ? 'es' : ''} anterior${restantes !== 1 ? 'es' : ''}</button>` : '');
}

window.guardarReunion = async function() {
  const fecha = document.getElementById('reu-fecha').value;
  const hora = document.getElementById('reu-hora').value;
  if (!fecha) { showToast('Falta la fecha', true); return; }
  const asistentesIds = [];
  document.querySelectorAll('.check-row.checked').forEach(r => asistentesIds.push(r.dataset.id));
  const asistentesNombres = asistentesIds.map(id => {
    const m = state.miembrosCache.find(x => x.id === id);
    return m ? m.nombre : '';
  }).filter(Boolean);
  const data = {
    celulaId: state.miCelulaId,
    liderEmail: state.usuarioActual.email,
    liderNombre: state.usuarioActual.nombre,
    fecha, hora,
    lugar: document.getElementById('reu-lugar').value.trim(),
    tema: document.getElementById('reu-tema').value.trim(),
    ofrenda: parseFloat(document.getElementById('reu-ofrenda').value) || 0,
    visitas: document.getElementById('reu-visitas').value.trim(),
    obs: document.getElementById('reu-obs').value.trim(),
    asistentesIds,
    asistentesNombres,
    cantAsistentes: asistentesIds.length,
    timestamp: serverTimestamp()
  };
  try {
    await addDoc(collection(db, 'reuniones'), data);
    showToast(`✔ Reunión guardada — ${asistentesIds.length} asistentes`, false);
    document.getElementById('reu-lugar').value = '';
    document.getElementById('reu-tema').value = '';
    document.getElementById('reu-ofrenda').value = '';
    document.getElementById('reu-visitas').value = '';
    document.getElementById('reu-obs').value = '';
    document.querySelectorAll('.check-row.checked').forEach(r => r.classList.remove('checked'));
  } catch (e) { showToast('❌ Error al guardar', true); console.error(e); }
};

window.verMasReuniones = function() {
  state.reunionesShown += 10;
  renderHistorial();
};
