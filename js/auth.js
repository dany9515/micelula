import { auth, db, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, doc, updateDoc } from './firebase.js';
import { state } from './state.js';
import { showToast, confirmar } from './ui.js';

export function initAuth(onAuthSuccess) {
  window._onAuthSuccess = onAuthSuccess;
}

let _loginPass = '';

window.togglePass = function(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
};

window.doLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const errBox = document.getElementById('login-error-box');
  errBox.innerHTML = '';
  btn.disabled = true; btn.textContent = 'Ingresando...';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    _loginPass = pass;
  } catch (e) {
    errBox.innerHTML = '<div class="login-error" style="display:block">❌ Usuario o contraseña incorrectos.</div>';
    btn.disabled = false; btn.textContent = 'Entrar';
  }
};

window.doLogout = async function() {
  if (await confirmar('Cerrar sesión', '¿Estás seguro que querés cerrar sesión?', 'Salir')) {
    if (state.unsubMiembros) { state.unsubMiembros(); state.unsubMiembros = null; }
    if (state.unsubReuniones) { state.unsubReuniones(); state.unsubReuniones = null; }
    if (state.unsubMateriales) { state.unsubMateriales(); state.unsubMateriales = null; }
    _loginPass = '';
    await signOut(auth);
    const btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error-box').innerHTML = '';
  }
};

window.doCambioPassObligatorio = async function() {
  const nueva = document.getElementById('nueva-pass').value;
  const nueva2 = document.getElementById('nueva-pass2').value;
  const err = document.getElementById('cambio-pass-error');
  const btn = document.getElementById('cambio-pass-btn');
  err.style.display = 'none';

  if (nueva.length < 8) { err.textContent = '⚠️ Mínimo 8 caracteres'; err.style.display = 'block'; return; }
  if (!/[A-Z]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos una mayúscula'; err.style.display = 'block'; return; }
  if (!/[a-z]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos una minúscula'; err.style.display = 'block'; return; }
  if (!/[0-9]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos un número'; err.style.display = 'block'; return; }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos un signo (!@#$%...)'; err.style.display = 'block'; return; }
  if (nueva !== nueva2) { err.textContent = '⚠️ Las contraseñas no coinciden'; err.style.display = 'block'; return; }

  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (_loginPass) {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, _loginPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      _loginPass = '';
    }
    await updatePassword(auth.currentUser, nueva);
    await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { cambiarPassword: false });
    state.usuarioActual.cambiarPassword = false;
    document.getElementById('cambio-pass-screen').style.display = 'none';
    window.mostrarApp();
  } catch (e) {
    err.textContent = '❌ Error al cambiar la contraseña. Intentá de nuevo.';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Guardar contraseña';
  }
};

window.abrirCambioPass = function() {
  document.getElementById('modal-pass').classList.add('show');
  ['pass-actual', 'pass-nueva', 'pass-repetir'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pass-error').style.display = 'none';
};

window.cerrarCambioPass = function() {
  document.getElementById('modal-pass').classList.remove('show');
};

window.cambiarPassword = async function() {
  const actual = document.getElementById('pass-actual').value;
  const nueva = document.getElementById('pass-nueva').value;
  const repetir = document.getElementById('pass-repetir').value;
  const err = document.getElementById('pass-error');
  err.style.display = 'none';
  if (nueva.length < 8) { err.textContent = '⚠️ Mínimo 8 caracteres'; err.style.display = 'block'; return; }
  if (!/[A-Z]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos una mayúscula'; err.style.display = 'block'; return; }
  if (!/[a-z]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos una minúscula'; err.style.display = 'block'; return; }
  if (!/[0-9]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos un número'; err.style.display = 'block'; return; }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(nueva)) { err.textContent = '⚠️ Debe tener al menos un signo (!@#$%...)'; err.style.display = 'block'; return; }
  if (nueva !== repetir) { err.textContent = '⚠️ Las contraseñas no coinciden'; err.style.display = 'block'; return; }
  try {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, actual);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, nueva);
    window.cerrarCambioPass();
    showToast('✔ Contraseña cambiada', false);
  } catch (e) {
    err.textContent = 'Contraseña actual incorrecta'; err.style.display = 'block';
  }
};
