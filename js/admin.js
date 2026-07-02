import { db, collection, addDoc, deleteDoc, getDocs, doc, query, where, orderBy, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast, formatFecha, confirmar, escHtml } from './ui.js';

let _detalleCelulaId = null;
let _detalleCelulaNombre = null;
let _reunionesMes = [];
let _celulaNames = {};
let _celulaLideres = {};
let _todasCelulas = [];
let _celulasFiltradas = [];
let _miemPorCel = {};
let _celulasMostradas = 5;
let _reunionesMesMostradas = 5;

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
      const [fy, fm, fd] = r.fecha.split('-').map(Number);
      const f = new Date(fy, fm - 1, fd);
      if (f.getMonth() === mesActual && f.getFullYear() === yearActual) {
        reuMes++;
        ofrMes += r.ofrenda || 0;
        _reunionesMes.push({ id: d.id, ...r });
      }
    });
    _reunionesMes.sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0));
    document.getElementById('admin-stat-reuniones').textContent = reuMes;
    document.getElementById('admin-stat-ofrenda').textContent = '$' + ofrMes.toLocaleString('es-AR');
    const acc = document.getElementById('admin-reuniones-mes-accordion');
    if (acc) { acc.classList.remove('open'); acc.innerHTML = ''; }
    const lbl = document.getElementById('admin-stat-reuniones-lbl');
    if (lbl) lbl.textContent = 'Reuniones (mes) ▾';
    _reunionesMesMostradas = 5;

    _todasCelulas = celSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    _todasCelulas.sort((a, b) => (b.creadaEn?.seconds ?? 0) - (a.creadaEn?.seconds ?? 0));
    _celulasFiltradas = [..._todasCelulas];
    _miemPorCel = {};
    miemSnap.docs.forEach(d => {
      const cId = d.data().celulaId;
      _miemPorCel[cId] = (_miemPorCel[cId] || 0) + 1;
    });
    _celulasMostradas = 5;
    document.getElementById('admin-filtro-lider').value = '';
    renderCelulasAdmin();
  } catch (e) { console.error(e); }
}

function renderCelulasAdmin() {
  const cont = document.getElementById('admin-celulas-list');
  if (_celulasFiltradas.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">📍</div><div>' + (_todasCelulas.length === 0 ? 'Aún no hay células creadas.' : 'Sin resultados') + '</div></div>';
    return;
  }
  const visibles = _celulasFiltradas.slice(0, _celulasMostradas);
  const restantes = _celulasFiltradas.length - _celulasMostradas;
  cont.innerHTML = visibles.map(c => `
    <div class="item-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-light);font-weight:700;margin-bottom:4px">${escHtml(c.nombre)}</div>
          <div class="item-info">👤 Líder: ${escHtml(c.liderNombre || c.liderEmail)}</div>
          <div class="item-info">✉️ ${escHtml(c.liderEmail)}</div>
          <div class="item-info">👥 ${_miemPorCel[c.id] || 0} miembros</div>
        </div>
        <button data-cel-id="${c.id}" data-cel-nombre="${escHtml(c.nombre)}" onclick="verDetalleCelula(this.dataset.celId, this.dataset.celNombre);" style="background:rgba(212,164,74,0.1);border:1px solid var(--gold-dark);border-radius:8px;color:var(--gold-light);font-family:var(--font-title);font-size:0.8rem;padding:8px 14px;cursor:pointer;letter-spacing:1px;">👁 VER DETALLE</button>
      </div>
    </div>
  `).join('') + (restantes > 0 ? `<button class="btn-secondary" onclick="cargarMasCelulas()" style="margin-top:4px">Cargar más (${restantes} restante${restantes !== 1 ? 's' : ''})</button>` : '');
}

window.cargarMasCelulas = function() {
  _celulasMostradas += 5;
  renderCelulasAdmin();
};

window.filtrarCelulas = function() {
  const filtro = document.getElementById('admin-filtro-lider').value.trim().toLowerCase();
  if (!filtro) {
    _celulasFiltradas = [..._todasCelulas];
  } else {
    _celulasFiltradas = _todasCelulas.filter(c => {
      const liderNombre = (c.liderNombre || c.liderEmail || '').toLowerCase();
      return liderNombre.includes(filtro);
    });
  }
  _celulasMostradas = 5;
  renderCelulasAdmin();
};

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
    const miembros = miemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const reuSnap = await getDocs(query(collection(db, 'reuniones'), where('celulaId', '==', celulaId), orderBy('fecha', 'desc')));
    const reuniones = reuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    contenido.innerHTML = `
      <div class="section" style="margin-bottom:16px">
        <div class="section-header"><h3>👥 Miembros (${miembros.length})</h3></div>
        <div class="section-body">
          ${miembros.length === 0 ? '<div style="color:var(--muted);font-style:italic">Sin miembros registrados</div>' :
            miembros.map(m => `
              <div data-miembro-id="${m.id}" style="padding:8px 0;border-bottom:0.5px solid var(--border);${m.obs ? 'cursor:pointer' : ''}" onclick="toggleObsAdmin(this.dataset.miembroId)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="color:var(--text)">${escHtml(m.nombre)}</span>
                  ${m.telefono ? `<span style="color:var(--muted);font-size:0.85rem">📱 ${escHtml(m.telefono)}</span>` : ''}
                </div>
                ${m.obs ? `<div id="obs-admin-${m.id}" style="margin-top:6px;padding:6px 8px;background:rgba(212,164,74,0.07);border-radius:6px;font-style:italic;color:var(--text);font-size:0.85rem">"${escHtml(m.obs)}"</div>` : ''}
              </div>`).join('')}
        </div>
      </div>
      <div class="section">
        <div class="section-header"><h3>📋 Últimas reuniones (${Math.min(reuniones.length, 3)} de ${reuniones.length})</h3></div>
        <div class="section-body">
          ${reuniones.length === 0 ? '<div style="color:var(--muted);font-style:italic">Sin reuniones registradas</div>' :
            reuniones.slice(0, 3).map(r => `
              <div class="item-card" style="margin-bottom:10px;position:relative">
                <button data-reunion-id="${r.id}" onclick="eliminarReunionAdmin(this.dataset.reunionId)" style="position:absolute;top:8px;right:8px;background:rgba(220,53,69,0.12);border:1px solid rgba(220,53,69,0.4);border-radius:6px;color:#e06c75;font-size:0.75rem;padding:3px 8px;cursor:pointer;">🗑</button>
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

window.toggleObsAdmin = function(id) {
  const el = document.getElementById('obs-admin-' + id);
  if (!el) return;
  el.classList.toggle('open');
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

function renderReunionesMesAccordion() {
  const acc = document.getElementById('admin-reuniones-mes-accordion');
  if (!_reunionesMes.length) {
    acc.innerHTML = '<div style="color:var(--muted);font-style:italic;padding:12px 4px;text-align:center;font-family:var(--font-body);font-size:0.9rem">Sin registros este mes</div>';
    return;
  }
  const visibles = _reunionesMes.slice(0, _reunionesMesMostradas);
  const restantes = _reunionesMes.length - _reunionesMesMostradas;
  acc.innerHTML = visibles.map(r => `
    <div class="item-card" style="margin-bottom:8px">
      <div style="font-family:var(--font-title);color:var(--gold-light);font-weight:700;font-size:0.9rem;margin-bottom:4px">${escHtml(_celulaNames[r.celulaId] || r.celulaId || '—')}</div>
      <div class="item-info">👤 ${escHtml(_celulaLideres[r.celulaId] || r.liderEmail || '—')}</div>
      <div class="item-info">📅 ${formatFecha(r.fecha)}${r.hora ? ' — ' + escHtml(r.hora) + 'hs' : ''}</div>
      ${r.tema ? `<div class="item-info">📖 ${escHtml(r.tema)}</div>` : ''}
      <div class="item-info">👥 ${r.cantAsistentes || 0} asistentes${r.ofrenda > 0 ? ' &nbsp;·&nbsp; 💰 $' + r.ofrenda.toLocaleString('es-AR') : ''}</div>
    </div>`).join('')
    + (restantes > 0 ? `<button class="btn-secondary" onclick="cargarMasReunionesMes()" style="margin-top:4px">Cargar más (${restantes} restante${restantes !== 1 ? 's' : ''})</button>` : '');
}

window.toggleReunionesMes = function() {
  const acc = document.getElementById('admin-reuniones-mes-accordion');
  const lbl = document.getElementById('admin-stat-reuniones-lbl');
  if (acc.classList.contains('open')) {
    acc.classList.remove('open');
    lbl.textContent = 'Reuniones (mes) ▾';
    _reunionesMesMostradas = 5;
    return;
  }
  lbl.textContent = 'Reuniones (mes) ▴';
  renderReunionesMesAccordion();
  acc.classList.add('open');
};

window.cargarMasReunionesMes = function() {
  _reunionesMesMostradas += 5;
  renderReunionesMesAccordion();
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

window.abrirReportes = function() {
  const modal = document.getElementById('modal-reportes');
  const lista = document.getElementById('reportes-lista');
  modal.classList.add('show');
  const meses = [];
  const hoy = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(d);
  }
  lista.innerHTML = meses.map(m => {
    const mes = m.getMonth();
    const año = m.getFullYear();
    const nombreMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(m);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(212,164,74,0.08);border:1px solid var(--border);border-radius:8px">
        <span style="color:var(--text);font-family:var(--font-body);text-transform:capitalize">${nombreMes}</span>
        <button class="btn-primary" onclick="descargarReporte(${mes}, ${año})" style="padding:6px 14px;font-size:0.85rem">📥 Descargar</button>
      </div>
    `;
  }).join('');
};

window.cerrarReportes = function() {
  document.getElementById('modal-reportes').classList.remove('show');
};

window.descargarReporte = async function(mes, año) {
  showToast('⏳ Generando reporte...', false);
  try {
    const inicioMes = new Date(año, mes, 1);
    const inicioProxMes = new Date(año, mes + 1, 1);
    const celSnap = await getDocs(collection(db, 'celulas'));
    const totalCelulas = celSnap.size;
    const miemSnap = await getDocs(collection(db, 'miembros'));
    const totalMiembros = miemSnap.size;
    let miembrosNuevos = 0;
    miemSnap.docs.forEach(d => {
      const m = d.data();
      if (m.ingreso) {
        const [iy, im, id] = m.ingreso.split('-').map(Number);
        if (iy === año && im === (mes + 1)) miembrosNuevos++;
      }
    });
    const reuSnap = await getDocs(collection(db, 'reuniones'));
    let ofrenda = 0;
    reuSnap.docs.forEach(d => {
      const r = d.data();
      if (r.fecha) {
        const [ry, rm, rd] = r.fecha.split('-').map(Number);
        if (ry === año && rm === (mes + 1)) ofrenda += r.ofrenda || 0;
      }
    });
    const csv = generarCSV(año, mes, totalCelulas, totalMiembros, miembrosNuevos, ofrenda);
    descargarCSV(csv, año, mes + 1);
    showToast('✔ Reporte descargado', false);
  } catch (e) {
    showToast('❌ Error al generar reporte', true);
    console.error(e);
  }
};

function generarCSV(año, mes, celulas, miembros, nuevos, ofrenda) {
  const nombreMes = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(año, mes, 1));
  const lineas = [
    'Reporte Mensual — Mi Célula',
    '',
    `Período,${nombreMes.toUpperCase()} ${año}`,
    '',
    'Indicador,Cantidad',
    `Células activas,${celulas}`,
    `Miembros activos,${miembros}`,
    `Miembros nuevos,${nuevos}`,
    `Ofrenda del mes,$${ofrenda.toLocaleString('es-AR')}`
  ];
  return lineas.join('\n');
}

function descargarCSV(csv, año, mes) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `reporte_${mes.toString().padStart(2, '0')}_${año}.csv`);
  link.click();
}
