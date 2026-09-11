const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function resetearPassword(email, passwordNueva) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: passwordNueva });
    console.log(`✅ Contraseña reseteada exitosamente para: ${email}`);
    console.log(`📝 Nueva contraseña: ${passwordNueva}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error al resetear contraseña:`, error.message);
    process.exit(1);
  }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ Uso: node scripts/resetear-password.js email@example.com password');
  process.exit(1);
}

resetearPassword(email, password);
