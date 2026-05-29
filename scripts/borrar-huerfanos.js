const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db = admin.firestore();

async function borrarHuerfanos() {
  const miemSnap = await db.collection('miembros').get();

  const huerfanos = miemSnap.docs.filter(d => !d.data().celulaId);

  if (huerfanos.length === 0) {
    console.log('No hay miembros huérfanos. Nada que borrar.');
    return;
  }

  console.log(`\nBorrando ${huerfanos.length} miembro(s) con celulaId vacío...\n`);

  for (const d of huerfanos) {
    await db.collection('miembros').doc(d.id).delete();
    console.log(`✔ Eliminado: ${d.data().nombre || '(sin nombre)'}  (${d.id})`);
  }

  console.log(`\nListo. ${huerfanos.length} documento(s) eliminados.`);
}

borrarHuerfanos().catch(console.error).finally(() => process.exit());
