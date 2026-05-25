import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast, formatFecha, actualizarStats } from './ui.js';

export function suscribirMiembros() {
  if (state.unsubMiembros) { state.unsubMiembros(); state.unsubMiembros = null; }
  state.miembrosCache = [];
  if (!state.miCelulaId || state.miCelulaId === 'admin') return;
  const q = query(collection(db, 'miembros'), where('celulaId', '==', state.miCelulaId));
  state.unsubMiembros = onSnapshot(q, snap => {
    state.miembrosCache = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    renderMiembros();
    renderAsistentes();
    actualizarStats();
  });
}

export function renderMiembros() {
  const cont = document.getElementById('miembros-list');
  if (state.miembrosCache.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">👥</div><div>Aún no hay miembros cargados.</div><div style="margin-top:8px;font-size:0.85rem">Agregá tu primer miembro arriba.</div></div>';
    return;
  }
  cont.innerHTML = state.miembrosCache.map(m => `
    <div class="item-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-light);font-weight:700;margin-bottom:4px">${m.nombre}</div>
          ${m.telefono ? `<div class="item-info">📱 ${m.telefono}</div>` : ''}
          ${m.edad ? `<div class="item-info">🎂 ${m.edad} años</div>` : ''}
          ${m.ingreso ? `<div class="item-info">📅 Ingreso: ${formatFecha(m.ingreso)}</div>` : ''}
          ${m.obs ? `<div class="item-info" style="margin-top:6px;font-style:italic">"${m.obs}"</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-danger" onclick="editarMiembro('${m.id}')" style="border-color:var(--gold);color:var(--gold)">✏️</button>
          <button class="btn-danger" onclick="eliminarMiembro('${m.id}','${m.nombre.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

export function renderAsistentes() {
  const cont = document.getElementById('asistentes-list');
  if (state.miembrosCache.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div>Cargá miembros primero para registrar la asistencia.</div></div>';
    return;
  }
  cont.innerHTML = state.miembrosCache.map(m => `
    <div class="check-row" data-id="${m.id}" onclick="this.classList.toggle('checked')">
      <div class="check-name">${m.nombre}</div>
      <div class="check-box">✓</div>
    </div>
  `).join('');
}

window.abrirNuevoMiembro = function() {
  document.getElementById('modal-miembro-titulo').textContent = '➕ Nuevo Miembro';
  ['m-nombre', 'm-telefono', 'm-edad', 'm-ingreso', 'm-obs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-miembro').dataset.editId = '';
  document.getElementById('modal-miembro').classList.add('show');
};

window.cerrarMiembro = function() {
  document.getElementById('modal-miembro').classList.remove('show');
};

window.editarMiembro = function(id) {
  const m = state.miembrosCache.find(x => x.id === id);
  if (!m) return;
  document.getElementById('modal-miembro-titulo').textContent = '✏️ Editar Miembro';
  document.getElementById('m-nombre').value = m.nombre || '';
  document.getElementById('m-telefono').value = m.telefono || '';
  document.getElementById('m-edad').value = m.edad || '';
  document.getElementById('m-ingreso').value = m.ingreso || '';
  document.getElementById('m-obs').value = m.obs || '';
  document.getElementById('modal-miembro').dataset.editId = id;
  document.getElementById('modal-miembro').classList.add('show');
};

window.guardarMiembro = async function() {
  const nombre = document.getElementById('m-nombre').value.trim();
  if (!nombre) { showToast('Falta el nombre', true); return; }
  const data = {
    nombre,
    telefono: document.getElementById('m-telefono').value.trim(),
    edad: document.getElementById('m-edad').value || null,
    ingreso: document.getElementById('m-ingreso').value || null,
    obs: document.getElementById('m-obs').value.trim(),
    celulaId: state.miCelulaId,
    actualizadoEn: serverTimestamp()
  };
  const editId = document.getElementById('modal-miembro').dataset.editId;
  try {
    if (editId) {
      await updateDoc(doc(db, 'miembros', editId), data);
      showToast('✔ Miembro actualizado', false);
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, 'miembros'), data);
      showToast('✔ Miembro agregado', false);
    }
    window.cerrarMiembro();
  } catch (e) { showToast('❌ Error al guardar', true); console.error(e); }
};

window.eliminarMiembro = async function(id, nombre) {
  if (!confirm(`¿Eliminar a ${nombre}?`)) return;
  try {
    await deleteDoc(doc(db, 'miembros', id));
    showToast('✔ Miembro eliminado', false);
  } catch (e) { showToast('❌ Error al eliminar', true); }
};
