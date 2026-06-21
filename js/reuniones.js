import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast, formatFecha, actualizarStats, escHtml, confirmar } from './ui.js';

function parseOfrenda(val) {
  if (!val || !String(val).trim()) return 0;
  // Acepta formato es-AR (26.000) y estándar (26000); quita puntos de miles, reemplaza coma decimal
  const cleaned = String(val).trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

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
          <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-light);font-weight:700">📅 ${formatFecha(r.fecha)} ${r.hora ? '— ' + escHtml(r.hora) + 'hs' : ''}</div>
          ${r.lugar ? `<div class="item-info" style="margin-top:4px">📍 ${escHtml(r.lugar)}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="cat-tag">${r.cantAsistentes || 0} asistentes</div>
          <button class="btn-danger" data-reunion-id="${r.id}" onclick="editarReunion(this.dataset.reunionId)" style="border-color:var(--gold);color:var(--gold);padding:4px 10px">✏️</button>
          <button class="btn-danger" data-reunion-id="${r.id}" onclick="eliminarReunion(this.dataset.reunionId)" style="padding:4px 10px">🗑️</button>
        </div>
      </div>
      ${r.tema ? `<div style="background:rgba(212,164,74,0.08);padding:8px 10px;border-radius:6px;margin-bottom:8px"><strong style="color:var(--gold-light)">📖 Tema:</strong> ${escHtml(r.tema)}</div>` : ''}
      ${r.ofrenda > 0 ? `<div class="item-info">💰 Ofrenda: $${r.ofrenda.toLocaleString('es-AR')}</div>` : ''}
      ${r.visitas ? `<div class="item-info">👋 Visitas: ${escHtml(r.visitas)}</div>` : ''}
      ${r.asistentesNombres && r.asistentesNombres.length ? `<div class="item-info" style="margin-top:6px">✓ ${r.asistentesNombres.map(escHtml).join(', ')}</div>` : ''}
      ${r.obs ? `<div class="item-info" style="margin-top:8px;font-style:italic;background:rgba(30,58,95,0.15);padding:8px 10px;border-radius:6px">"${escHtml(r.obs)}"</div>` : ''}
    </div>
  `).join('') + (restantes > 0 ? `<button class="btn-secondary" onclick="verMasReuniones()" style="margin-top:4px">Ver ${restantes} reunión${restantes !== 1 ? 'es' : ''} anterior${restantes !== 1 ? 'es' : ''}</button>` : '');
}

window.guardarReunion = async function() {
  if (!state.miCelulaId || state.miCelulaId === 'admin') { showToast('Error: no hay célula activa', true); return; }
  const fecha = document.getElementById('reu-fecha').value;
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
    fecha,
    hora: document.getElementById('reu-hora').value,
    lugar: document.getElementById('reu-lugar').value.trim(),
    tema: document.getElementById('reu-tema').value.trim(),
    ofrenda: parseOfrenda(document.getElementById('reu-ofrenda').value),
    visitas: document.getElementById('reu-visitas').value.trim(),
    obs: document.getElementById('reu-obs').value.trim(),
    asistentesIds,
    asistentesNombres,
    cantAsistentes: asistentesIds.length,
    timestamp: serverTimestamp()
  };
  const btnGuardar = document.querySelector('#panel-reunion > .btn-primary');
  if (btnGuardar) btnGuardar.disabled = true;
  try {
    await addDoc(collection(db, 'reuniones'), data);
    showToast(`✔ Reunión guardada — ${data.cantAsistentes} asistentes`, false);
    _limpiarFormReunion();
  } catch (e) { showToast('❌ Error al guardar', true); console.error(e); }
  if (btnGuardar) btnGuardar.disabled = false;
};

function _limpiarFormReunion() {
  ['reu-lugar', 'reu-tema', 'reu-ofrenda', 'reu-visitas', 'reu-obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.querySelectorAll('.check-row.checked').forEach(r => r.classList.remove('checked'));
}

window.editarReunion = function(id) {
  const r = state.reunionesCache.find(x => x.id === id);
  if (!r) return;
  document.getElementById('modal-editar-reunion').dataset.editId = id;
  document.getElementById('edit-reu-fecha').value = r.fecha || '';
  document.getElementById('edit-reu-hora').value = r.hora || '';
  document.getElementById('edit-reu-lugar').value = r.lugar || '';
  document.getElementById('edit-reu-tema').value = r.tema || '';
  document.getElementById('edit-reu-ofrenda').value = r.ofrenda || '';
  document.getElementById('edit-reu-visitas').value = r.visitas || '';
  document.getElementById('edit-reu-obs').value = r.obs || '';
  const cont = document.getElementById('edit-asistentes-list');
  if (state.miembrosCache.length === 0) {
    cont.innerHTML = '<div style="color:var(--muted);font-style:italic">Sin miembros en esta célula</div>';
  } else {
    cont.innerHTML = state.miembrosCache.map(m => `
      <div class="check-row ${r.asistentesIds && r.asistentesIds.includes(m.id) ? 'checked' : ''}" data-id="${m.id}" onclick="this.classList.toggle('checked')">
        <div class="check-name">${escHtml(m.nombre)}</div>
        <div class="check-box">✓</div>
      </div>
    `).join('');
  }
  document.getElementById('modal-editar-reunion').classList.add('show');
};

window.cerrarEditarReunion = function() {
  document.getElementById('modal-editar-reunion').classList.remove('show');
};

window.guardarEdicionReunion = async function() {
  const modal = document.getElementById('modal-editar-reunion');
  const id = modal.dataset.editId;
  if (!id) return;
  const fecha = document.getElementById('edit-reu-fecha').value;
  if (!fecha) { showToast('Falta la fecha', true); return; }
  const asistentesIds = [];
  modal.querySelectorAll('.check-row.checked').forEach(r => asistentesIds.push(r.dataset.id));
  const asistentesNombres = asistentesIds.map(aid => {
    const m = state.miembrosCache.find(x => x.id === aid);
    return m ? m.nombre : '';
  }).filter(Boolean);
  try {
    await updateDoc(doc(db, 'reuniones', id), {
      fecha,
      hora: document.getElementById('edit-reu-hora').value,
      lugar: document.getElementById('edit-reu-lugar').value.trim(),
      tema: document.getElementById('edit-reu-tema').value.trim(),
      ofrenda: parseOfrenda(document.getElementById('edit-reu-ofrenda').value),
      visitas: document.getElementById('edit-reu-visitas').value.trim(),
      obs: document.getElementById('edit-reu-obs').value.trim(),
      asistentesIds,
      asistentesNombres,
      cantAsistentes: asistentesIds.length,
    });
    showToast('✔ Reunión actualizada', false);
    window.cerrarEditarReunion();
  } catch (e) { showToast('❌ Error al guardar', true); console.error(e); }
};

window.eliminarReunion = async function(id) {
  if (!await confirmar('Eliminar reunión', '¿Eliminás esta reunión? Esta acción no se puede deshacer.', '🗑 Eliminar', true)) return;
  try {
    await deleteDoc(doc(db, 'reuniones', id));
    showToast('✔ Reunión eliminada', false);
  } catch (e) { showToast('❌ Error al eliminar', true); console.error(e); }
};

window.verMasReuniones = function() {
  state.reunionesShown += 10;
  renderHistorial();
};
