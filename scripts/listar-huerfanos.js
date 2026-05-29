// Requiere: node scripts/listar-huerfanos.js
// Antes de correr: npm install firebase-admin (solo la primera vez)
// y colocar el archivo serviceAccountKey.json en la raíz del proyecto
//
// Nota: no existe colección "ofrendas" separada.
// La ofrenda es un campo numérico dentro de cada documento de "reuniones".
// Verificar reuniones huérfanas es suficiente para cubrir ese caso.

const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db = admin.firestore();

async function listarHuerfanos() {
  const [celSnap, miemSnap, reuSnap] = await Promise.all([
    db.collection('celulas').get(),
    db.collection('miembros').get(),
    db.collection('reuniones').get(),
  ]);

  const celulaIds = new Set(celSnap.docs.map(d => d.id));

  // --- Miembros ---
  const miemHuerfanos = miemSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => !celulaIds.has(m.celulaId));

  console.log(`\n=== Miembros huérfanos: ${miemHuerfanos.length} ===\n`);
  if (miemHuerfanos.length === 0) {
    console.log('Ninguno.');
  } else {
    miemHuerfanos.forEach(m => {
      console.log(`ID doc  : ${m.id}`);
      console.log(`Nombre  : ${m.nombre || '(sin nombre)'}`);
      console.log(`celulaId: ${m.celulaId || '(vacío)'}`);
      console.log('---');
    });
  }

  // --- Reuniones (incluye control de ofrendas embebidas) ---
  const reuHuerfanas = reuSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => !celulaIds.has(r.celulaId));

  console.log(`\n=== Reuniones huérfanas: ${reuHuerfanas.length} ===\n`);
  if (reuHuerfanas.length === 0) {
    console.log('Ninguna.');
  } else {
    let ofrEndaTotal = 0;
    reuHuerfanas.forEach(r => {
      console.log(`ID doc  : ${r.id}`);
      console.log(`Fecha   : ${r.fecha || '(sin fecha)'}`);
      console.log(`Lugar   : ${r.lugar || '(sin lugar)'}`);
      console.log(`Ofrenda : $${r.ofrenda || 0}`);
      console.log(`celulaId: ${r.celulaId || '(vacío)'}`);
      console.log('---');
      ofrEndaTotal += r.ofrenda || 0;
    });
    if (ofrEndaTotal > 0) {
      console.log(`Ofrendas embebidas en reuniones huérfanas: $${ofrEndaTotal.toLocaleString('es-AR')}`);
    }
  }

  // --- Resumen ---
  console.log('\n--- Resumen ---');
  console.log(`Células activas             : ${celulaIds.size}`);
  console.log(`Miembros totales            : ${miemSnap.size}`);
  console.log(`  └─ Huérfanos              : ${miemHuerfanos.length}`);
  console.log(`Reuniones totales           : ${reuSnap.size}`);
  console.log(`  └─ Huérfanas              : ${reuHuerfanas.length}`);
  console.log(`Ofrendas (campo en reuniones): no es colección separada`);
}

listarHuerfanos().catch(console.error).finally(() => process.exit());
