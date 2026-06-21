import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast, formatFecha, confirmar, escHtml } from './ui.js';

export function suscribirMateriales() {
  if (state.unsubMateriales) { state.unsubMateriales(); state.unsubMateriales = null; }
  const q = query(collection(db, 'materiales'), orderBy('timestamp', 'desc'));
  state.unsubMateriales = onSnapshot(q, snap => {
    state.materialesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMateriales();
  });
}

export function renderMateriales() {
  const cont = document.getElementById('materiales-list');
  if (state.materialesCache.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">📚</div><div>Aún no hay materiales disponibles.</div></div>';
    return;
  }
  const esAdmin = state.usuarioActual && state.usuarioActual.rol === 'admin';
  const visibles = state.materialesCache.slice(0, state.materialesShown);
  const restantes = state.materialesCache.length - state.materialesShown;
  cont.innerHTML = visibles.map(m => `
    <div class="material-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <div class="material-title">${escHtml(m.titulo)}</div>
        <div class="cat-tag">${escHtml(m.categoria)}</div>
      </div>
      <div class="material-meta">📅 ${formatFecha(m.fecha)} · 👤 ${escHtml(m.subidoPor || 'Admin')}</div>
      ${m.descripcion ? `<div class="material-desc">${escHtml(m.descripcion)}</div>` : ''}
      <div class="material-actions">
        <a href="${escHtml(m.url)}" target="_blank" rel="noopener" class="btn-download">📥 Descargar</a>
        ${esAdmin ? `<button class="btn-edit" data-material-id="${m.id}" onclick="editarMaterial(this.dataset.materialId)">✏️</button>` : ''}
        ${esAdmin ? `<button class="btn-delete" data-id="${m.id}" data-titulo="${escHtml(m.titulo)}" onclick="eliminarMaterialBtn(this)">🗑️</button>` : ''}
      </div>
    </div>
  `).join('') + (restantes > 0 ? `<button class="btn-secondary" onclick="verMasMateriales()" style="margin-top:4px">Ver ${restantes} material${restantes !== 1 ? 'es' : ''} más</button>` : '');
}

window.abrirSubirMaterial = function() {
  document.getElementById('modal-material-titulo').textContent = '⬆️ Subir Material';
  ['mat-titulo', 'mat-desc', 'mat-url'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mat-categoria').value = 'Tema Semanal';
  document.getElementById('modal-material').dataset.editId = '';
  document.getElementById('modal-material').classList.add('show');
};

window.cerrarMaterial = function() {
  document.getElementById('modal-material').classList.remove('show');
};

window.editarMaterial = function(id) {
  const m = state.materialesCache.find(x => x.id === id);
  if (!m) return;
  document.getElementById('modal-material-titulo').textContent = '✏️ Editar Material';
  document.getElementById('mat-titulo').value = m.titulo || '';
  document.getElementById('mat-categoria').value = m.categoria || 'Tema Semanal';
  document.getElementById('mat-desc').value = m.descripcion || '';
  document.getElementById('mat-url').value = m.url || '';
  document.getElementById('modal-material').dataset.editId = id;
  document.getElementById('modal-material').classList.add('show');
};

window.guardarMaterial = async function() {
  const titulo = document.getElementById('mat-titulo').value.trim();
  const url = document.getElementById('mat-url').value.trim();
  if (!titulo || !url) { showToast('Falta título o link', true); return; }
  const data = {
    titulo,
    categoria: document.getElementById('mat-categoria').value,
    descripcion: document.getElementById('mat-desc').value.trim(),
    url,
    subidoPor: state.usuarioActual.nombre,
    fecha: new Date().toISOString().split('T')[0],
    timestamp: serverTimestamp()
  };
  const editId = document.getElementById('modal-material').dataset.editId;
  try {
    if (editId) {
      await updateDoc(doc(db, 'materiales', editId), data);
      showToast('✔ Material actualizado', false);
    } else {
      await addDoc(collection(db, 'materiales'), data);
      showToast('✔ Material publicado', false);
    }
    window.cerrarMaterial();
  } catch (e) { showToast('❌ Error al guardar', true); console.error(e); }
};

window.eliminarMaterialBtn = function(btn) {
  window.eliminarMaterial(btn.dataset.id, btn.dataset.titulo);
};

window.eliminarMaterial = async function(id, titulo) {
  if (!await confirmar('Eliminar material', `¿Eliminás "${titulo}"?`, '🗑 Eliminar', true)) return;
  try {
    await deleteDoc(doc(db, 'materiales', id));
    showToast('✔ Material eliminado', false);
  } catch (e) { showToast('❌ Error al eliminar', true); }
};

window.verMasMateriales = function() {
  state.materialesShown += 10;
  renderMateriales();
};
