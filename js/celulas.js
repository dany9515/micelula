import { db, collection, addDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { showToast } from './ui.js';
import { suscribirMiembros } from './miembros.js';
import { suscribirReuniones } from './reuniones.js';

export async function cargarMiCelula() {
  if (state.usuarioActual.rol === 'admin') {
    state.miCelulaId = 'admin';
    return;
  }
  const q = query(collection(db, 'celulas'), where('liderEmail', '==', state.usuarioActual.email));
  const snap = await getDocs(q);
  if (!snap.empty) {
    state.misCelulas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.miCelulaId = state.misCelulas[0].id;
    actualizarSelectorCelulas();
    actualizarChipsCelula();
  } else {
    state.misCelulas = [];
    state.miCelulaId = null;
    mostrarMensajeSinCelula();
  }
}

export function actualizarSelectorCelulas() {
  const selector = document.getElementById('selector-celula-container');
  if (!selector) return;
  if (state.misCelulas.length === 0) { selector.style.display = 'none'; return; }
  selector.style.display = 'block';
  const sel = document.getElementById('selector-celula');
  sel.innerHTML = state.misCelulas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  sel.value = state.miCelulaId;
  sel.style.display = state.misCelulas.length > 1 ? 'block' : 'none';
}

export function actualizarChipsCelula() {
  if (state.usuarioActual.rol === 'admin' || !state.miCelulaId || state.misCelulas.length <= 1) {
    ['reunion', 'miembros', 'historial'].forEach(p => {
      const chip = document.getElementById('chip-celula-' + p);
      if (chip) chip.style.display = 'none';
    });
    return;
  }
  const celula = state.misCelulas.find(c => c.id === state.miCelulaId);
  if (!celula) return;
  ['reunion', 'miembros', 'historial'].forEach(p => {
    const chip = document.getElementById('chip-celula-' + p);
    const nombre = document.getElementById('chip-celula-' + p + '-nombre');
    if (chip && nombre) {
      chip.style.display = 'inline-block';
      nombre.textContent = celula.nombre;
    }
  });
}

function mostrarMensajeSinCelula() {
  const bienvenida = document.querySelector('.welcome-card');
  if (bienvenida) {
    bienvenida.insertAdjacentHTML('afterend', `
      <div class="section" id="msg-sin-celula" style="margin-bottom:14px;border-color:rgba(212,164,74,0.4)">
        <div class="section-header"><h3>📍 Tu primera célula</h3></div>
        <div class="section-body" style="text-align:center;padding:20px">
          <p style="color:var(--muted);margin-bottom:16px">Aún no tenés ninguna célula creada. ¡Creá tu primera célula para empezar!</p>
          <button class="btn-primary" onclick="abrirCrearMiCelula()">➕ Crear mi célula</button>
        </div>
      </div>
    `);
  }
}

window.cambiarCelula = function(id) {
  state.miCelulaId = id;
  actualizarChipsCelula();
  suscribirMiembros();
  suscribirReuniones();
};

window.confirmarEliminarCelula = function() {
  const celula = state.misCelulas.find(c => c.id === state.miCelulaId);
  if (!celula) return;
  if (confirm(`⚠️ Vas a eliminar "${celula.nombre}" y todos sus miembros y reuniones. Esta acción no se puede deshacer. ¿Confirmás?`)) {
    eliminarCelula(state.miCelulaId);
  }
};

async function eliminarCelula(celulaId) {
  try {
    showToast('⏳ Eliminando célula...', false);
    const miemSnap = await getDocs(query(collection(db, 'miembros'), where('celulaId', '==', celulaId)));
    await Promise.all(miemSnap.docs.map(d => deleteDoc(doc(db, 'miembros', d.id))));
    const reuSnap = await getDocs(query(collection(db, 'reuniones'), where('celulaId', '==', celulaId)));
    await Promise.all(reuSnap.docs.map(d => deleteDoc(doc(db, 'reuniones', d.id))));
    await deleteDoc(doc(db, 'celulas', celulaId));
    state.misCelulas = state.misCelulas.filter(c => c.id !== celulaId);
    if (state.misCelulas.length > 0) {
      state.miCelulaId = state.misCelulas[0].id;
      actualizarSelectorCelulas();
      actualizarChipsCelula();
      suscribirMiembros();
      suscribirReuniones();
    } else {
      state.miCelulaId = null;
      document.getElementById('selector-celula-container').style.display = 'none';
      mostrarMensajeSinCelula();
    }
    showToast('✔ Célula eliminada', false);
  } catch (e) {
    showToast('❌ Error al eliminar', true);
    console.error(e);
  }
}

window.abrirCrearMiCelula = function() {
  document.getElementById('mi-cel-nombre').value = '';
  document.getElementById('modal-celula-lider').classList.add('show');
};

window.cerrarCrearMiCelula = function() {
  document.getElementById('modal-celula-lider').classList.remove('show');
};

window.guardarMiCelula = async function() {
  const nombre = document.getElementById('mi-cel-nombre').value.trim();
  if (!nombre) { showToast('Ingresá un nombre para la célula', true); return; }
  let ref;
  try {
    ref = await addDoc(collection(db, 'celulas'), {
      nombre,
      liderEmail: state.usuarioActual.email,
      liderNombre: state.usuarioActual.nombre,
      creadaEn: serverTimestamp(),
      activa: true
    });
  } catch (e) {
    showToast('❌ Error al crear la célula', true);
    console.error(e);
    return;
  }
  state.misCelulas.push({ id: ref.id, nombre, liderEmail: state.usuarioActual.email, liderNombre: state.usuarioActual.nombre });
  state.miCelulaId = ref.id;
  actualizarSelectorCelulas();
  suscribirMiembros();
  suscribirReuniones();
  window.cerrarCrearMiCelula();
  showToast('✔ Célula creada exitosamente', false);
  const msg = document.getElementById('msg-sin-celula');
  if (msg) msg.remove();
};
