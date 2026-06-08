# Mi Célula — CLAUDE.md

Aplicación web PWA para gestión de células de la iglesia C.F.C.P.N.
Stack: HTML + CSS + JS (ES modules) + Firebase (Firestore + Hosting + Auth).

## Estructura del proyecto

```
index.html          — UI completa (modales, paneles, login)
styles.css          — Estilos (dark theme, variables CSS)
js/
  app.js            — Inicialización y navegación entre paneles
  auth.js           — Login, logout, cambio de contraseña
  state.js          — Estado global compartido (usuarioActual, miCelulaId, caches)
  ui.js             — Utilidades: showToast, formatFecha, escHtml, confirmar
  celulas.js        — CRUD de células (líder)
  miembros.js       — CRUD de miembros
  reuniones.js      — CRUD de reuniones + historial
  materiales.js     — CRUD de materiales (admin)
  admin.js          — Panel de administración
manifest.json       — PWA manifest (en la raíz)
sw.js               — Service Worker mínimo (pass-through, requerido para instalabilidad PWA)
assets/
  icon-192.svg
  icon-512.svg
scripts/
  listar-huerfanos.js   — Lista miembros y reuniones sin celulaId válido
  borrar-huerfanos.js   — Elimina miembros con celulaId vacío
firestore.rules     — Reglas de seguridad de Firestore
firebase.json       — Configuración de Firebase Hosting
.firebaserc         — Proyecto: micelula-cfcpn
```

## Roles de usuario

- **admin** — ve todas las células, puede crear/eliminar células y reuniones desde el panel admin
- **líder** — ve y gestiona solo sus propias células, miembros y reuniones

## Colecciones Firestore

| Colección   | Campos clave                                      |
|-------------|---------------------------------------------------|
| `celulas`   | nombre, liderEmail, liderNombre, activa           |
| `miembros`  | nombre, celulaId, telefono, edad, ingreso, obs    |
| `reuniones` | celulaId, liderEmail, fecha, hora, lugar, tema, ofrenda, asistentesIds, asistentesNombres, cantAsistentes, visitas, obs |
| `materiales`| titulo, categoria, descripcion, url, subidoPor    |
| `usuarios`  | email, nombre, rol, debecambiarpass               |

**Nota:** no existe colección `ofrendas` separada. La ofrenda es un campo numérico dentro de cada documento de `reuniones`.

## Convenciones

- Datos de Firestore que se inyectan en `innerHTML` deben pasar por `escHtml()` (definida en `ui.js`).
- Botones de eliminar que pasan datos de usuario usan `data-attributes` en lugar de interpolación directa en `onclick` (ver `eliminarMiembroBtn`, `eliminarMaterialBtn`).
- Todas las confirmaciones destructivas usan `confirmar()` de `ui.js`, nunca `confirm()` nativo.
- Antes de guardar en `miembros` o `reuniones`, validar que `state.miCelulaId` no sea nulo.

---

## Sesión 2026-05-27

### Cambios realizados (todos en producción)

**Commit `0601539` — refactor: SW zombie, modal confirm, XSS**
- Eliminado `sw.js` (auto-destructor ya no necesario; `index.html` desregistra SWs activamente desde d9004ef).
- Reemplazados los 6 `confirm()` nativos por modal de confirmación propio (`confirmar()` en `ui.js`), con soporte para estilo danger (botón rojo) y texto configurable.
- Agregada `escHtml()` en `ui.js` y aplicada en todos los renders que inyectan datos de Firestore en `innerHTML` (`admin.js`, `reuniones.js`, `miembros.js`, `materiales.js`, `celulas.js`).
- Botones de eliminar miembro y material migrados a `data-attributes` para evitar inyección en `onclick`.

**Commit `c663c44` — feat: editar reuniones desde historial**
- Modal de edición pre-populado con todos los campos (fecha, hora, lugar, tema, ofrenda, visitas, obs) y asistentes marcados.
- Botón ✏️ en cada card del historial.
- `firestore.rules`: líderes ahora pueden hacer `update` en sus propias reuniones (`resource.data.liderEmail == myEmail()`).

**Commit `cdb1ed7` — feat: eliminar reuniones + validación celulaId**
- Botón 🗑️ en cada card del historial para que el líder elimine sus propias reuniones.
- `guardarReunion()` y `guardarMiembro()` validan que `state.miCelulaId` sea válido antes de escribir en Firestore — previene documentos huérfanos.
- `firestore.rules`: delete de reuniones simplificado a `resource.data.liderEmail == myEmail()` (antes usaba `get()` a celulas, frágil si la célula ya no existía).
- `.gitignore`: agregados `serviceAccountKey.json` y `scripts/node_modules/`.

### Limpieza de Firestore (via scripts de admin SDK)
- Eliminados 8 miembros con `celulaId` vacío (creados por un bug anterior al guardar sin célula activa).
- Eliminadas 2 reuniones con `celulaId` vacío (mismo origen).

### Scripts de mantenimiento (`scripts/`)
- `listar-huerfanos.js` — lista miembros y reuniones cuyo `celulaId` no existe en `celulas`; también reporta ofrendas embebidas en reuniones huérfanas.
- `borrar-huerfanos.js` — elimina miembros con `celulaId` vacío.
- Requieren `serviceAccountKey.json` en la raíz y `npm install firebase-admin --prefix scripts`.

---

## Sesión 2026-05-29

### Cambios realizados (todos en producción)

**Verificación — botón ✏️ de materiales visible solo para admin**
- Confirmado que `renderMateriales()` en `materiales.js` ya protegía correctamente el botón con `esAdmin` en la UI, y que `firestore.rules` protege el `write` con `isAdmin()`. Sin cambios necesarios.

**Commit `9c0cdf8` — feat: limitar historial a últimas 3 reuniones en detalle de célula (admin)**
- En `admin.js`, `verDetalleCelula()`: el render del historial ahora usa `reuniones.slice(0, 3)`.
- El encabezado muestra `"Últimas reuniones (N de M)"` para que el admin sepa cuántas hay en total.
- La consulta ya traía los datos ordenados por `fecha desc`, no fue necesario tocar Firestore.

**Commits `d9ff7a0` y `b46d8fc` — chore: CLAUDE.md, scripts y Firebase Hosting deshabilitado**
- `CLAUDE.md` y `scripts/` commiteados al repo por primera vez.
- `firebase.json` modificado: hosting ignora todos los archivos y redirige todo (`**`) con 301 permanente a `https://micelula.operlog.com.ar`.
- Deploy a Firebase Hosting aplicado para activar el redirect — `micelula-cfcpn.web.app` ya no sirve la app.

### URL de producción
- **Producción real:** `https://micelula.operlog.com.ar` (GitHub Pages, rama `main`)
- **Firebase Hosting:** `micelula-cfcpn.web.app` redirige 301 a producción (hosting deshabilitado funcionalmente)
- **Deploy:** siempre con `git push origin main`. No usar `firebase deploy` salvo para cambios en Firestore rules.

---

## Sesión 2026-06-02

### Cambios realizados (todos en producción)

**Commit `b99ea57` — fix: restaurar instalación PWA — manifest en raíz, SW mínimo, start_url correcto**

Diagnóstico: la PWA dejó de instalarse correctamente (Chrome solo ofrecía "agregar acceso directo" sin ícono). Tres causas:
1. `index.html` apuntaba a `href="manifest.json"` pero el archivo estaba en `assets/manifest.json` → browser nunca encontraba el manifest → sin ícono ni nombre.
2. El código en `index.html` solo desregistraba todos los SWs y nunca registraba uno nuevo → Chrome no mostraba el prompt de instalación PWA (requiere SW activo).
3. `start_url: "/micelula/"` incorrecto para dominio propio `micelula.operlog.com.ar` (debía ser `"/"`).

Cambios:
- `assets/manifest.json` movido a la raíz del repo como `manifest.json`.
- `index.html`: link actualizado a `href="/manifest.json"`; bloque de unregister-all reemplazado por `navigator.serviceWorker.register('/sw.js')`.
- `manifest.json`: `start_url` corregido de `/micelula/` a `/`; paths de íconos actualizados a `assets/icon-*.svg`.
- `sw.js` creado en la raíz: SW mínimo con install/activate/fetch pass-through, sin caché agresiva.

**Nota sobre el SW:** el bloque unregister-all que existía desde el commit `d9004ef` (sesión 2026-05-27) fue eliminado. Ya no tiene razón de existir: el zombie SW original está largo tiempo desaparecido de todos los browsers. El nuevo `sw.js` es un pass-through puro — no cachea nada, solo satisface el criterio de instalabilidad de Chrome.

---

## Sesión 2026-06-03

### Cambios realizados (todos en producción)

**Commit `a198eda` — feat: acordeón de reuniones del mes en panel admin**

La stat card "Reuniones (mes)" del panel admin funciona ahora como acordeón. Al hacer click se despliega debajo una lista con todas las reuniones del mes de todas las células, ordenadas por fecha descendente. Cada ítem muestra: nombre de la célula, nombre del líder, fecha, hora, tema, cantidad de asistentes y ofrenda. Si no hay reuniones el mes muestra "Sin registros este mes". El chevron del label alterna entre ▾ (cerrado) y ▴ (abierto). El acordeón se cierra y resetea automáticamente cada vez que se recarga el panel admin.

Cambios en `index.html`:
- La stat card de reuniones tiene `onclick="toggleReunionesMes()"`, `cursor:pointer` e `id="admin-stat-reuniones-lbl"` en el label.
- Se agregó `<div id="admin-reuniones-mes-accordion">` (oculto por defecto) entre el stats-grid y el botón "Crear Célula".

Cambios en `js/admin.js`:
- Variables de módulo `_reunionesMes` (array) y `_celulaNames` / `_celulaLideres` (mapas `celulaId → nombre/líder`), pobladas en `cargarPanelAdmin()` a partir de los snapshots ya cargados (sin lecturas adicionales a Firestore).
- `window.toggleReunionesMes()`: alterna el acordeón; renderiza las cards al abrir.

**Commit `d8b2c03` — feat: acordeón de observaciones en panel miembros y detalle admin**

En el panel Miembros del líder y en el modal VER DETALLE del admin, cada card de miembro es ahora clickeable. Al hacer tap se despliega debajo un div con las observaciones. Si el miembro no tiene obs, el tap no hace nada (el div no existe, la función retorna temprano). El `cursor:pointer` solo aparece en cards que tienen obs.

Cambios en `js/miembros.js`:
- `renderMiembros()`: se quitó el obs inline del card; se agregó `onclick="toggleObsMiembro(id)"` en el card. Los botones ✏️/🗑️ están en un `div` con `onclick="event.stopPropagation()"` para no interferir. Si el miembro tiene obs, se renderiza `<div id="obs-miem-{id}" style="display:none">` al final del card.
- `window.toggleObsMiembro(id)`: alterna `display:none/block` del div de obs.

Cambios en `js/admin.js`:
- `verDetalleCelula()`: cambió `miemSnap.docs.map(d => d.data())` a `map(d => ({ id: d.id, ...d.data() }))` para tener el ID disponible. Cada fila de miembro tiene `onclick="toggleObsAdmin(id)"` y, si tiene obs, un `<div id="obs-admin-{id}" style="display:none">`.
- `window.toggleObsAdmin(id)`: mismo patrón que `toggleObsMiembro`.

---

## Sesión 2026-06-04

### Cambios realizados (todos en producción)

**Commit — fix+feat: paginación en admin, bug apóstrofe y timezone**

- `admin.js`: panel admin muestra las primeras 5 células con botón "Cargar más (N restantes)" que suma 5 por click. Variables de módulo `_todasCelulas`, `_miemPorCel`, `_celulasMostradas`; función interna `renderCelulasAdmin()`; `window.cargarMasCelulas()`. El panel resetea a 5 al recargar.
- `admin.js`: botón "VER DETALLE" migrado a `data-cel-id` / `data-cel-nombre` + `this.dataset` — elimina el bug de apóstrofe en nombres de células.
- `admin.js`: parseo de fecha corregido de `new Date(r.fecha)` (UTC) a `new Date(fy, fm-1, fd)` (local) — el 1° de cada mes ya no cae en el mes anterior en Argentina.

**Nota:** el botón ✏️ en Historial del líder ya existía desde la sesión 2026-05-27 (commit `c663c44`).

---

## Sesión 2026-06-05

### Cambios realizados (pendientes de commit y push)

**Fotos en reuniones + carrusel en panel Inicio**

Archivos nuevos:
- `js/fotos.js` — carga la colección `fotos` ordenada por `creadaEn desc` (limit 20), filtra los últimos 7 días (fallback a más recientes), renderiza carrusel con botones ‹ › y contador N/total. Oculta el contenedor si no hay fotos.
- `storage.rules` — reglas de Firebase Storage: `allow read/write if request.auth != null` para `fotos-celulas/{allPaths=**}`.

Archivos modificados:
- `js/firebase.js` — agregados imports y exports de Storage SDK (`getStorage`, `ref`, `uploadBytes`, `getDownloadURL`) y `limit` de Firestore.
- `js/reuniones.js` — `guardarReunion()` ahora es async; si hay foto seleccionada la comprime (max 1200px, JPEG 82%) con canvas, la sube a `fotos-celulas/{celulaId}/{fecha}`, guarda `fotoUrl` en el doc de reunión y crea un doc en colección `fotos` para el carrusel. Nuevas funciones: `window.onFotoPreview()` (preview local con FileReader), `window.quitarFoto()`, `_limpiarFormReunion()` (ahora también llama `quitarFoto`).
- `js/app.js` — importa `cargarCarrusel` de `fotos.js`; lo llama en `mostrarApp()`.
- `index.html` — sección "📸 Foto de la reunión (opcional)" en el formulario de reunión (botón estilizado + input file oculto + contenedor de preview); carrusel `#carrusel-container` en panel Inicio (entre stats y quick-actions), oculto por defecto hasta que `cargarCarrusel()` confirme que hay fotos.
- `firestore.rules` — nueva colección `fotos`: `allow read/write if isAuth()`.
- `firebase.json` — agregado bloque `"storage": { "rules": "storage.rules" }`.

Nueva colección Firestore `fotos`:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reunionId` | string | ID del doc en `reuniones` |
| `celulaId` | string | ID de la célula |
| `celulaNombre` | string | Nombre de la célula (desnormalizado) |
| `liderNombre` | string | Nombre del líder |
| `fecha` | string | YYYY-MM-DD |
| `fotoUrl` | string | URL de descarga de Storage |
| `creadaEn` | timestamp | serverTimestamp() |

Reglas ya deployadas a Firebase (Firestore + Storage). Código local, sin commit. **Feature pausada — se retoma en sesión futura.**

**Lección aprendida — no commitear archivos relacionados juntos rompe producción:**
El commit `ebff9e3` incluyó `reuniones.js` con imports de Storage (`storage`, `ref`, `uploadBytes`, `getDownloadURL`) pero `firebase.js` quedó sin commitear. En producción `firebase.js` no exportaba esos símbolos → `SyntaxError` al cargar el módulo → la app entera fallaba (ni el login aparecía). Fix en sesión 2026-06-06.

**Commit `ebff9e3` — fix: parsear ofrenda en formato argentino (punto de miles)**

`parseFloat("26.000")` devolvía `26` porque el browser interpreta el punto como separador decimal. Fix en `js/reuniones.js`:
- Nueva función `parseOfrenda(val)`: quita todos los puntos de miles, reemplaza coma decimal por punto y llama `parseFloat`. Soporta `26.000` → `26000`, `1.000.000` → `1000000`, `26,5` → `26.5`.
- Usada en `guardarReunion()` y `guardarEdicionReunion()` en lugar de `parseFloat` directo.

Fix en `index.html`:
- Ambos inputs de ofrenda cambiados de `type="number"` a `type="text" inputmode="decimal"` — el `type="number"` era la raíz del problema (el browser siempre trata el punto como decimal en inputs numéricos).

La visualización con `toLocaleString('es-AR')` ya estaba correcta y no requirió cambios.

**Commit `db75738` — fix: re-autenticación en cambio de contraseña obligatorio**

Una usuaria no podía cambiar su contraseña en la pantalla de cambio obligatorio (primer login). La validación de caracteres especiales ya incluía `*`, así que el problema era `auth/requires-recent-login`: Firebase considera `updatePassword` una operación sensible y puede rechazarla aunque el login sea reciente.

Fix en `js/auth.js`:
- `_loginPass` guarda la contraseña del login temporalmente.
- `doCambioPassObligatorio()` hace `reauthenticateWithCredential` con esa contraseña justo antes de `updatePassword`, garantizando sesión fresca.
- `_loginPass` se limpia tras usarse y también al hacer logout.
- No afecta a usuarios que ya cambiaron su contraseña (nunca llegan a `doCambioPassObligatorio`).

---

## Sesión 2026-06-06

### Cambios realizados (en producción)

**Commit `fbde667` — fix: exportar Storage SDK desde firebase.js**

La app quedó completamente rota luego de la sesión anterior: `reuniones.js` (commiteado en `ebff9e3`) importaba `storage`, `ref`, `uploadBytes`, `getDownloadURL` de `firebase.js`, pero `firebase.js` nunca se commiteó con esos exports. Resultado: `SyntaxError` al parsear el módulo → `doLogin is not defined` → ningún usuario podía entrar.

Fix: commitear `firebase.js` con los exports faltantes de Storage SDK y `limit` de Firestore. Los demás archivos de la feature fotos (`js/app.js`, `firestore.rules`, `firebase.json`, `js/fotos.js`, `storage.rules`) siguen pendientes sin commitear.

**Sobre el caché post-deploy:**
- Usuarios con PWA instalada: el SW hace fetch directo a la red → se actualiza solo.
- Usuarios en browser sin SW: necesitan hard reload (Ctrl+Shift+R) o abrir en incógnito hasta que el CDN de GitHub Pages propague (generalmente pocos minutos).

---

## Sesión 2026-06-08

### Cambios realizados (en producción)

**Commit `57b86cf` — feat: paginación en acordeón reuniones y orden células por fecha**

Dos mejoras en `js/admin.js`:

1. **Acordeón de reuniones del mes** — antes mostraba todas las reuniones del mes de una vez. Ahora muestra las primeras 5 (ya ordenadas por `fecha` desc) con un botón "Cargar más (N restantes)" que suma de a 5. Nueva variable de módulo `_reunionesMesMostradas = 5`; lógica de render extraída a `renderReunionesMesAccordion()`; `window.cargarMasReunionesMes()`. El contador se resetea a 5 al cerrar el acordeón y al recargar el panel.

2. **Orden de células** — `_todasCelulas` ahora se ordena por `creadaEn.seconds` descendente tras construirse, mostrando las células más nuevas primero. Las células sin `creadaEn` (documentos viejos) quedan al final (se les asigna `seconds = 0`).

---

## Pendientes abiertos

### Mejora — código duplicado en eliminación de célula
La lógica de borrar miembros + reuniones + célula está duplicada en `celulas.js` (`eliminarCelula`) y `admin.js` (`eliminarCelulaAdmin`). Se podría extraer a una función compartida.
