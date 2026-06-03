import { db, collection, addDoc, deleteDoc, getDocs, doc, query, where, orderBy, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast, formatFecha, confirmar, escHtml } from './ui.js';

let _detalleCelulaId = null;
let _detalleCelulaNombre = null;
let _reunionesMes = [];
let _celulaNames = {};
let _celulaLideres = {};

export async function cargarPanelAdmin() {
  if (!state.usuarioActual || state.usuarioActual.rol !== 'admin') return;
  try {
    const celSnap = await getDocs(collection(db, 'celulas'));
    const miemSnap = await getDocs(collection(db, 'miembros'));
    const reuSnap = await getDocs(collection(db, 'reuniones'));

    document.getElementById('admin-stat-celulas').textContent = celSnap.size;
    document.getElementById('admin-stat-personas').textContent = miemSnap.size;

    const mesActual = new Date().getMonth();
    const yearActual = new Date().getFullYear();
    let reuMes = 0, ofrMes = 0;
    _reunionesMes = [];
    _celulaNames = {};
    celSnap.docs.forEach(d => {
      _celulaNames[d.id] = d.data().nombre;
      _celulaLideres[d.id] = d.data().liderNombre || d.data().liderEmail;
    });
    reuSnap.docs.forEach(d => {
      const r = d.data();
      if (!r.fecha) return;
      const f = new Date(r.fecha);
      if (f.getMonth() === mesActual && f.getFullYear() === yearActual) {
        reuMes++;
        ofrMes += r.ofrenda || 0;
        _reunionesMes.push({ id: d.id, ...r });
      }
    });
    _reunionesMes.sort((a, b) => b.fecha.localeCompare(a.fecha));
    document.getElementById('admin-stat-reuniones').textContent = reuMes;
    document.getElementById('admin-stat-ofrenda').textContent = '$' + ofrMes.toLocaleString('es-AR');
    const acc = document.getElementById('admin-reuniones-mes-accordion');
    if (acc) { acc.style.display = 'none'; acc.innerHTML = ''; }
    const lbl = document.getElementById('admin-stat-reuniones-lbl');
    if (lbl) lbl.textContent = 'Reuniones (mes) ▾';

    const cont = document.getElementById('admin-celulas-list');
    if (celSnap.empty) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">📍</div><div>Aún no hay células creadas.</div></div>';
      return;
    }
    const celulas = celSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const miemPorCel = {};
    miemSnap.docs.forEach(d => {
      const cId = d.data().celulaId;
      miemPorCel[cId] = (miemPorCel[cId] || 0) + 1;
    });
    cont.innerHTML = celulas.map(c => `
      <div class="item-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-light);font-weight:700;margin-bottom:4px">${escHtml(c.nombre)}</div>
            <div class="item-info">👤 Líder: ${escHtml(c.liderNombre || c.liderEmail)}</div>
            <div class="item-info">✉️ ${escHtml(c.liderEmail)}</div>
            <div class="item-info">👥 ${miemPorCel[c.id] || 0} miembros</div>
          </div>
          <button onclick="verDetalleCelula('${c.id}','${escHtml(c.nombre)}');" style="background:rgba(212,164,74,0.1);border:1px solid var(--gold-dark);border-radius:8px;color:var(--gold-light);font-family:var(--font-title);font-size:0.8rem;padding:8px 14px;cursor:pointer;letter-spacing:1px;">👁 VER DETALLE</button>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

window.verDetalleCelula = async function(celulaId, nombreCelula) {
  _detalleCelulaId = celulaId;
  _detalleCelulaNombre = nombreCelula;
  const modal = document.getElementById('modal-detalle-celula');
  const titulo = document.getElementById('detalle-celula-titulo');
  const contenido = document.getElementById('detalle-celula-contenido');
  titulo.textContent = '📍 ' + nombreCelula;
  contenido.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">⏳ Cargando...</div>';
  modal.classList.add('show');
  try {
    const miemSnap = await getDocs(query(collection(db, 'miembros'), where('celulaId', '==', celulaId)));
    const miembros = miemSnap.docs.map(d => d.data());
    const reuSnap = await getDocs(query(collection(db, 'reuniones'), where('celulaId', '==', celulaId), orderBy('fecha', 'desc')));
    const reuniones = reuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    contenido.innerHTML = `
      <div class="section" style="margin-bottom:16px">
        <div class="section-header"><h3>👥 Miembros (${miembros.length})</h3></div>
        <div class="section-body">
          ${miembros.length === 0 ? '<div style="color:var(--muted);font-style:italic">Sin miembros registrados</div>' :
            miembros.map(m => `
              <div style="padding:8px 0;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <span style="color:var(--text)">${escHtml(m.nombre)}</span>
                ${m.telefono ? `<span style="color:var(--muted);font-size:0.85rem">📱 ${escHtml(m.telefono)}</span>` : ''}
              </div>`).join('')}
        </div>
      </div>
      <div class="section">
        <div class="section-header"><h3>📋 Últimas reuniones (${Math.min(reuniones.length, 3)} de ${reuniones.length})</h3></div>
        <div class="section-body">
          ${reuniones.length === 0 ? '<div style="color:var(--muted);font-style:italic">Sin reuniones registradas</div>' :
            reuniones.slice(0, 3).map(r => `
              <div class="item-card" style="margin-bottom:10px;position:relative">
                <button onclick="eliminarReunionAdmin('${r.id}')" style="position:absolute;top:8px;right:8px;background:rgba(220,53,69,0.12);border:1px solid rgba(220,53,69,0.4);border-radius:6px;color:#e06c75;font-size:0.75rem;padding:3px 8px;cursor:pointer;">🗑</button>
                <div style="font-family:var(--font-title);color:var(--gold-light);font-weight:700;margin-bottom:6px;padding-right:40px">
                  📅 ${formatFecha(r.fecha)} ${r.hora ? '— ' + escHtml(r.hora) + 'hs' : ''}
                </div>
                ${r.lugar ? `<div class="item-info">📍 ${escHtml(r.lugar)}</div>` : ''}
                ${r.tema ? `<div style="background:rgba(212,164,74,0.08);padding:8px 10px;border-radius:6px;margin:6px 0"><strong style="color:var(--gold-light)">📖 Tema:</strong> ${escHtml(r.tema)}</div>` : ''}
                <div class="item-info">👥 ${r.cantAsistentes || 0} asistentes</div>
                ${r.asistentesNombres && r.asistentesNombres.length ? `<div class="item-info">✓ ${r.asistentesNombres.map(escHtml).join(', ')}</div>` : ''}
                ${r.visitas ? `<div class="item-info">👋 Visitas: ${escHtml(r.visitas)}</div>` : ''}
                ${r.ofrenda > 0 ? `<div class="item-info">💰 Ofrenda: $${r.ofrenda.toLocaleString('es-AR')}</div>` : ''}
                ${r.obs ? `<div class="item-info" style="font-style:italic">"${escHtml(r.obs)}"</div>` : ''}
              </div>`).join('')}
        </div>
      </div>`;
  } catch (e) {
    contenido.innerHTML = '<div style="color:red;padding:12px">❌ Error al cargar los datos</div>';
    console.error(e);
  }
};

window.cerrarDetalleCelula = function() {
  document.getElementById('modal-detalle-celula').classList.remove('show');
};

window.eliminarCelulaAdmin = async function() {
  if (!_detalleCelulaId) return;
  if (!await confirmar('Eliminar célula', `Vas a eliminar "${_detalleCelulaNombre}" y TODOS sus miembros y reuniones. Esta acción no se puede deshacer.`, '🗑 Eliminar', true)) return;
  try {
    showToast('⏳ Eliminando célula...', false);
    const miemSnap = await getDocs(query(collection(db, 'miembros'), where('celulaId', '==', _detalleCelulaId)));
    await Promise.all(miemSnap.docs.map(d => deleteDoc(doc(db, 'miembros', d.id))));
    const reuSnap = await getDocs(query(collection(db, 'reuniones'), where('celulaId', '==', _detalleCelulaId)));
    await Promise.all(reuSnap.docs.map(d => deleteDoc(doc(db, 'reuniones', d.id))));
    await deleteDoc(doc(db, 'celulas', _detalleCelulaId));
    _detalleCelulaId = null;
    _detalleCelulaNombre = null;
    window.cerrarDetalleCelula();
    showToast('✔ Célula eliminada', false);
    cargarPanelAdmin();
  } catch (e) {
    showToast('❌ Error al eliminar', true);
    console.error(e);
  }
};

window.eliminarReunionAdmin = async function(reunionId) {
  if (!await confirmar('Eliminar reunión', '¿Eliminás esta reunión? Esta acción no se puede deshacer.', '🗑 Eliminar', true)) return;
  try {
    await deleteDoc(doc(db, 'reuniones', reunionId));
    showToast('✔ Reunión eliminada', false);
    await window.verDetalleCelula(_detalleCelulaId, _detalleCelulaNombre);
  } catch (e) {
    showToast('❌ Error al eliminar reunión', true);
    console.error(e);
  }
};

window.abrirNuevaCelula = function() {
  ['cel-nombre', 'cel-email', 'cel-lider'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-celula').classList.add('show');
};

window.cerrarCelula = function() {
  document.getElementById('modal-celula').classList.remove('show');
};

window.toggleReunionesMes = function() {
  const acc = document.getElementById('admin-reuniones-mes-accordion');
  const lbl = document.getElementById('admin-stat-reuniones-lbl');
  if (acc.style.display !== 'none') {
    acc.style.display = 'none';
    lbl.textContent = 'Reuniones (mes) ▾';
    return;
  }
  lbl.textContent = 'Reuniones (mes) ▴';
  if (!_reunionesMes.length) {
    acc.innerHTML = '<div style="color:var(--muted);font-style:italic;padding:12px 4px;text-align:center;font-family:var(--font-body);font-size:0.9rem">Sin registros este mes</div>';
  } else {
    acc.innerHTML = _reunionesMes.map(r => `
      <div class="item-card" style="margin-bottom:8px">
        <div style="font-family:var(--font-title);color:var(--gold-light);font-weight:700;font-size:0.9rem;margin-bottom:4px">${escHtml(_celulaNames[r.celulaId] || r.celulaId || '—')}</div>
        <div class="item-info">👤 ${escHtml(_celulaLideres[r.celulaId] || r.liderEmail || '—')}</div>
        <div class="item-info">📅 ${formatFecha(r.fecha)}${r.hora ? ' — ' + escHtml(r.hora) + 'hs' : ''}</div>
        ${r.tema ? `<div class="item-info">📖 ${escHtml(r.tema)}</div>` : ''}
        <div class="item-info">👥 ${r.cantAsistentes || 0} asistentes${r.ofrenda > 0 ? ' &nbsp;·&nbsp; 💰 $' + r.ofrenda.toLocaleString('es-AR') : ''}</div>
      </div>`).join('');
  }
  acc.style.display = 'block';
};

window.guardarCelula = async function() {
  const nombre = document.getElementById('cel-nombre').value.trim();
  const email = document.getElementById('cel-email').value.trim().toLowerCase();
  const lider = document.getElementById('cel-lider').value.trim();
  if (!nombre || !email || !lider) { showToast('Faltan datos', true); return; }
  try {
    await addDoc(collection(db, 'celulas'), {
      nombre, liderEmail: email, liderNombre: lider,
      creadaEn: serverTimestamp(), activa: true
    });
    showToast('✔ Célula creada — Recordá crear el usuario en Firebase', false);
    window.cerrarCelula();
    cargarPanelAdmin();
  } catch (e) { showToast('❌ Error', true); console.error(e); }
};
