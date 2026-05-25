import { auth, db, onAuthStateChanged, signOut, getDoc, doc } from './firebase.js';
import { state } from './state.js';
import { showToast, actualizarStats } from './ui.js';
import './auth.js';
import { cargarMiCelula, actualizarChipsCelula, actualizarSelectorCelulas } from './celulas.js';
import { suscribirMiembros, renderMiembros, renderAsistentes } from './miembros.js';
import { suscribirReuniones, renderHistorial } from './reuniones.js';
import { suscribirMateriales, renderMateriales } from './materiales.js';
import { cargarPanelAdmin } from './admin.js';

// Exponer mostrarApp globalmente para que auth.js pueda llamarla
window.mostrarApp = mostrarApp;

onAuthStateChanged(auth, async user => {
  document.getElementById('loading').classList.add('hidden');
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (!userDoc.exists()) {
        showToast('Usuario no autorizado', true);
        await signOut(auth);
        return;
      }
      state.usuarioActual = { email: user.email, uid: user.uid, ...userDoc.data() };
    } catch (e) {
      await signOut(auth);
      return;
    }

    if (state.usuarioActual.cambiarPassword === true) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('cambio-pass-screen').style.display = 'flex';
      document.getElementById('cambio-pass-screen').style.flexDirection = 'column';
      document.getElementById('app-screen').style.display = 'none';
      return;
    }

    mostrarApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('cambio-pass-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';
    const btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
});

async function mostrarApp() {
  const info = state.usuarioActual;
  document.getElementById('header-user').textContent = '👤 ' + info.nombre;
  document.getElementById('header-user').className = 'header-user' + (info.rol === 'admin' ? ' admin' : '');
  document.getElementById('welcome-name').textContent = `Bienvenido, ${info.nombre.split(' ')[0]}`;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('cambio-pass-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('app-screen').style.flexDirection = 'column';
  if (info.rol === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    cargarPanelAdmin();
  }
  await cargarMiCelula();
  suscribirMiembros();
  suscribirReuniones();
  suscribirMateriales();
  const now = new Date();
  document.getElementById('reu-fecha').value = now.toISOString().split('T')[0];
  document.getElementById('reu-hora').value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

window.showPanel = function(id, btn, fromSidebar) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (fromSidebar) {
    const panelIndex = ['inicio', 'reunion', 'miembros', 'historial', 'materiales', 'admin'].indexOf(id);
    const tabs = document.querySelectorAll('.nav-tab');
    if (tabs[panelIndex]) tabs[panelIndex].classList.add('active');
  } else {
    const panelIndex = ['inicio', 'reunion', 'miembros', 'historial', 'materiales', 'admin'].indexOf(id);
    const sidebtns = document.querySelectorAll('.sidebar-btn');
    if (sidebtns[panelIndex]) sidebtns[panelIndex].classList.add('active');
  }
  if (id === 'reunion') renderAsistentes();
  if (id === 'miembros') renderMiembros();
  if (id === 'historial') renderHistorial();
  if (id === 'materiales') renderMateriales();
  if (id === 'admin') cargarPanelAdmin();
};

// Listeners de teclado para formularios
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
document.getElementById('nueva-pass').addEventListener('keydown', e => { if (e.key === 'Enter') window.doCambioPassObligatorio(); });
document.getElementById('nueva-pass2').addEventListener('keydown', e => { if (e.key === 'Enter') window.doCambioPassObligatorio(); });
document.getElementById('pass-actual').addEventListener('keydown', e => { if (e.key === 'Enter') window.cambiarPassword(); });
document.getElementById('pass-nueva').addEventListener('keydown', e => { if (e.key === 'Enter') window.cambiarPassword(); });
document.getElementById('pass-repetir').addEventListener('keydown', e => { if (e.key === 'Enter') window.cambiarPassword(); });
