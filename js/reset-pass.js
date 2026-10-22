import { auth, reauthenticateWithCredential, EmailAuthProvider } from './firebase.js';
import { state } from './state.js';
import { showToast, escHtml, usuarioAEmail, usuarioCorto } from './ui.js';

// "Resetear contraseña" del panel admin: solo lo ve dani.admin.
// Desde el navegador no se puede cambiar la contraseña de otra persona: lo hace el servidor de Cloudflare (worker/).
// El servidor exige que Daniel haya escrito su contraseña hace menos de 5 minutos; acá se la pedimos si pasaron más de 4.
const SERVIDOR = 'https://micelula-admin.dany1234491.workers.dev/resetear';
const ADMIN_RESET = 'dani.admin';
const CONFIRMACION_VIGENTE = 4 * 60 * 1000;

let _usuarioAResetear = '';
let _mensaje = '';

export function mostrarResetPass() {
  const esDani = usuarioCorto(state.usuarioActual?.email) === ADMIN_RESET;
  document.getElementById('seccion-reset-pass').style.display = esDani ? '' : 'none';
  document.getElementById('reset-resultado').innerHTML = '';
  document.getElementById('reset-error').style.display = 'none';
}

window.resetearPassword = async function() {
  document.getElementById('reset-error').style.display = 'none';
  document.getElementById('reset-resultado').innerHTML = '';
  const usuario = usuarioCorto(usuarioAEmail(document.getElementById('reset-usuario').value));
  if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(usuario)) { _mostrarError('⚠️ Escribí el usuario que querés resetear'); return; }
  _usuarioAResetear = usuario;
  const { authTime } = await auth.currentUser.getIdTokenResult();
  if (Date.now() - new Date(authTime).getTime() < CONFIRMACION_VIGENTE) await _enviar();
  else _abrirConfirmacion();
};

function _abrirConfirmacion() {
  document.getElementById('reset-confirmar-usuario').textContent = _usuarioAResetear;
  document.getElementById('reset-mi-usuario').value = ADMIN_RESET;
  document.getElementById('reset-mi-pass').value = '';
  document.getElementById('reset-confirmar-error').style.display = 'none';
  document.getElementById('modal-reset-confirmar').classList.add('show');
  document.getElementById('reset-mi-pass').focus();
}

window.cerrarConfirmarReset = function() {
  document.getElementById('modal-reset-confirmar').classList.remove('show');
  document.getElementById('reset-mi-pass').value = '';
};

window.confirmarReset = async function() {
  const pass = document.getElementById('reset-mi-pass').value;
  const err = document.getElementById('reset-confirmar-error');
  const btn = document.getElementById('reset-confirmar-btn');
  err.style.display = 'none';
  if (!pass) return;
  btn.disabled = true; btn.textContent = 'Confirmando...';
  try {
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pass));
  } catch (e) {
    err.textContent = e.code === 'auth/too-many-requests' ? '⚠️ Demasiados intentos. Esperá unos minutos.' : '❌ Contraseña incorrecta';
    err.style.display = 'block';
    return;
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmar y resetear';
  }
  window.cerrarConfirmarReset();
  await _enviar();
};

async function _enviar() {
  const btn = document.getElementById('reset-btn');
  btn.disabled = true; btn.textContent = 'Reseteando...';
  try {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(SERVIDOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ usuario: _usuarioAResetear }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { _abrirConfirmacion(); return; }
    if (!r.ok || !j.password) { _mostrarError('❌ ' + (j.error || 'No se pudo resetear. Probá de nuevo.')); return; }
    _mostrarResultado(j.usuario, j.password);
    document.getElementById('reset-usuario').value = '';
  } catch (e) {
    _mostrarError('❌ Sin conexión. Probá de nuevo.');
  } finally {
    btn.disabled = false; btn.textContent = '🔑 Resetear';
  }
}

function _mostrarResultado(usuario, password) {
  _mensaje = `Hola! Te reseteé la contraseña de MiCélula.\n\nEntrá en micelula.operlog.com.ar con:\nUsuario: ${usuario}\nContraseña: ${password}`;
  document.getElementById('reset-resultado').innerHTML = `
    <div class="reset-ok">
      <div class="reset-ok-lbl">Contraseña nueva de ${escHtml(usuario)}</div>
      <div class="reset-ok-pass">${escHtml(password)}</div>
      <a class="btn-primary reset-wa" href="https://wa.me/?text=${encodeURIComponent(_mensaje)}" target="_blank" rel="noopener">📲 Mandar por WhatsApp</a>
      <button class="btn-secondary" onclick="copiarMensajeReset(this)">📋 Copiar mensaje</button>
    </div>`;
}

window.copiarMensajeReset = async function(btn) {
  try {
    await navigator.clipboard.writeText(_mensaje);
    btn.textContent = '✔ Copiado';
  } catch (e) {
    showToast('No se pudo copiar', true);
  }
};

function _mostrarError(msg) {
  const err = document.getElementById('reset-error');
  err.textContent = msg;
  err.style.display = 'block';
}

document.getElementById('reset-usuario').addEventListener('keydown', e => { if (e.key === 'Enter') window.resetearPassword(); });
document.getElementById('reset-mi-pass').addEventListener('keydown', e => { if (e.key === 'Enter') window.confirmarReset(); });
