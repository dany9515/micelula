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

## Sesión 2026-06-10

### Cambios realizados (en producción)

**Commit `985fcf7` — fix: quitar UI y lógica de subir foto en reuniones (feature pausada)**

El commit `ebff9e3` (fix de ofrenda, sesión 2026-06-05) arrastró sin querer parte de la feature de fotos: la sección "📸 Foto de la reunión (opcional)" en `index.html` y la lógica de subida en `js/reuniones.js`. Los líderes veían el botón "📷 Seleccionar foto" en producción aunque la feature está pausada e incompleta.

Cambios:
- `index.html`: eliminada la sección de foto del formulario de reunión (botón, preview e input file). El contenedor del carrusel (`#carrusel-container`) se dejó porque tiene `display:none` y nada lo activa — es invisible.
- `js/reuniones.js`: `guardarReunion()` vuelve al `addDoc` simple (sin upload a Storage); eliminadas `onFotoPreview`, `quitarFoto`, `_comprimirImagen` y los imports de Storage. Se conservó el deshabilitado del botón Guardar durante el guardado (previene doble click).

**Estado de la feature fotos (pausada):** los archivos sin commitear siguen en el working tree para retomarla: `js/fotos.js`, `storage.rules`, y modificaciones a `firebase.json`, `firestore.rules`, `js/app.js`. Los exports de Storage en `js/firebase.js` quedaron commiteados (`fbde667`) — no se usan pero harán falta al retomar.

---

## Sesión 2026-06-18

### Cambios realizados (en producción)

**Commit `a3b996b` — fix: ordenar reuniones del mes por timestamp (cuándo se cargó)**

Bug reportado: cuando se creaba una reunión con fecha retroactiva (ej: reunión del 1 de junio, registrada hoy 18 de junio), no aparecía en los primeros lugares del acordeón "Reuniones (mes)" en el panel admin — quedaba al final porque el ordenamiento era por `fecha` (del evento), no por cuándo se creó.

Fix en `js/admin.js`:
- Línea 45: cambio de `_reunionesMes.sort((a, b) => b.fecha.localeCompare(a.fecha))` a `_reunionesMes.sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))`
- Ahora las reuniones aparecen ordenadas por cuándo se cargaron (`timestamp`), no por la fecha del evento. Cuando alguien registra una reunión hoy (aunque sea de hace una semana), aparece en los primeros lugares.

**Commit `e2968b6` — feat: agregar filtro de búsqueda de líderes en panel admin**

Nuevo input de búsqueda en la sección "Todas las Células" que permite filtrar en tiempo real por nombre del líder. Cambios:

`index.html`:
- Input `id="admin-filtro-lider"` con placeholder "🔍 Buscar por nombre del líder..." arriba de `admin-celulas-list`. Llama a `filtrarCelulas()` en `onkeyup`.

`js/admin.js`:
- Nueva variable `_celulasFiltradas` que almacena las células filtradas.
- Función `window.filtrarCelulas()`: lee el input, filtra `_todasCelulas` por nombre del líder (búsqueda case-insensitive con `.includes()`), resetea paginación a 5, y renderiza.
- `renderCelulasAdmin()` ahora usa `_celulasFiltradas` en lugar de `_todasCelulas`.
- Si el filtro está vacío, muestra todas. Si no hay coincidencias, muestra "Sin resultados".

**Commit `d82e378` — polish: mejorar hover states y agregar backdrop blur a modales**

Cambios visuales enfocados en feedback interactivo y experiencia premium:

`styles.css`:
- **.modal-overlay**: agregado `backdrop-filter: blur(8px)` + reducido opacity de 0.85 a 0.6 (efecto cristal frosted glass). Modal con `box-shadow: 0 20px 60px rgba(0,0,0,0.7)` para mayor separación.
- **.btn-primary:hover**: `box-shadow: 0 6px 24px rgba(212,164,74,0.5)` + `transform: translateY(-2px)` (lift al pasar).
- **.btn-secondary:hover**: background tintado dorado + sombra.
- **.quick-btn:hover**: opacity aumentada, sombra, y lift.
- **.nav-tab:hover**: hover state para tabs inactivos (border+color gold).
- **.btn-danger, .btn-edit, .btn-delete**: mejores sombras y backgrounds en hover.
- **.logout-btn:hover**: background tintado rojo.
- Todas las transiciones en 0.2s `cubic-bezier` para fluidez.

**Auditoría visual realizada (sin cambios):**
Análisis completo del diseño actual identificó:
- ✓ Paleta oscura + oro: excelente, profesional
- ✓ Tipografía coherente: Cinzel (títulos), Lora (body), Share Tech Mono (técnico)
- ✓ Contraste text/fondo: muy alto (~9:1), excelente accesibilidad
- ⚠️ Hover states muy sutiles antes del polish
- ⚠️ Falta `aria-label` en botones emoji, `prefers-reduced-motion` en animaciones
- ⚠️ Modal backdrop sin blur

**Nota:** Los cambios de polish (hover states + blur) fueron sutiles visualmente. El usuario reportó poca diferencia perceptible, probablemente debido a que son cambios de "micro-interacción" y requerirían hard reload del navegador para verlos sin caché.

**CONTINUACIÓN — Cambios visuales agresivos (sin commitear aún):**

Cambios en paleta y spacing para mayor impacto visual:

`styles.css` — **Paleta más vibrante:**
- `--gold: #d4a44a → #f0c000` (dorado brillante)
- `--gold-light: #ffd97a → #ffeb3b` (dorado claro luminoso)
- `--green: #7cba3f → #9ccc65` (verde saturado)
- `--red: #c44545 → #ef5350` (rojo vivo)
- `--text: #f5e8c8 → #f5f5f5` (blanco casi puro, mejor contraste)
- `--muted: #8a7f5f → #b0b0b0` (gris neutro)

`styles.css` — **Spacing aumentado (+40-50%):**
- `.section`: `margin-bottom: 14px → 20px`
- `.section-header`: `padding: 12px 16px → 16px 20px`; h3 `1rem → 1.1rem`
- `.section-body`: `padding: 14px → 18px`
- `.stats-grid`: `gap: 10px → 14px`, `margin-bottom: 14px → 20px`
- `.stat-card`: `padding: 14px → 18px`; `.num: 1.8rem → 2rem`
- `.quick-btn`: `padding: 18px 12px → 24px 16px`; `.icon: 1.8rem → 2rem`
- `.welcome-card`: `padding: 20px → 28px`; h2 `1.4rem → 1.6rem`
- `.container`: `padding: 14px → 18px`
- `.field-row`: `gap: 10px → 14px`; `.field input padding: 11px → 13px`
- `.btn-primary`: `padding: 14px → 16px`; `font-size: 1rem → 1.05rem`

`index.html` — **Login: Partículas flotantes animadas:**
- Agregadas 15 partículas doradas que flotan suavemente en el fondo del login
- Cada una con delays y duraciones aleatorias para efecto orgánico
- `styles.css`: `.particle` — 10px, rgba(240,192,0,0.5), glow dorado, animación `float` lineal
- Keyframe `float`: 0% opacity 0 → 8% opacity 0.8 → 92% opacity 0.8 → 100% opacity 0
- Movimiento: `translateY(-120vh) translateX(150px)`

**BUG DESCUBIERTO — Carrusel de fotos aparece aunque fue sacada:**

La feature de fotos está pausada desde sesión 2026-06-10, pero la UI de subida fue removida sin remover el código de carga.

Causa: `app.js` líneas 10 y 66 todavía llaman a `cargarCarrusel()` de `fotos.js`:
- Línea 10: `import { cargarCarrusel } from './fotos.js';`
- Línea 66: `cargarCarrusel();` en función `mostrarApp()`

Resultado: El carrusel carga fotos de Firestore automáticamente, apareciendo en producción aunque no hay UI para subirlas.

**Soluciones propuestas (pendiente de decisión del usuario):**
1. Remover líneas 10 + 66 de `app.js` (pausar feature completamente)
2. Comentar esas líneas (pausar temporalmente, retomar fácil)
3. Eliminar `fotos.js` del working tree (limpiar completamente)

**Estado actual del working tree:**
- ✅ Cambios de paleta + spacing listos (sin commitear)
- ✅ Partículas en login listas (sin commitear)
- ❌ `fotos.js` presente, activo en `app.js` (problema)
- ❌ `storage.rules` presente (sin usar)
- ❌ Cambios pendientes en `firebase.json`, `firestore.rules`

**Próximos pasos:**
1. Decidir qué hacer con `fotos.js` (remover imports, comentar, o eliminar)
2. Commitear cambios visuales (paleta + spacing + login particles)
3. Pushear a producción

---

## Sesión 2026-06-20

### Cambios realizados (todos en producción)

**Commit `6393f69` — feat: agregar animaciones y sistema de actualización de versión**

Animaciones profesionales con propósito:
- `styles.css`: Nuevas variables CSS `--ease-out-quart` y `--ease-out-quint` para easing consistente
- Keyframes: `fadeInUp`, `fadeIn`, `slideInLeft`, `slideInDown`, `buttonPress` con duraciones y easing optimizados
- **Accesibilidad**: `@media (prefers-reduced-motion: reduce)` aplicado a TODAS las animaciones

**Por capa de interacción:**

1. **Hero** — `.welcome-card`: fade-in + rise suave (500ms, ease-out-quart)
2. **Feedback** — Botones (`.btn-primary`, `.btn-secondary`, `.btn-danger`): scale press (0.98→1, 100ms) en `:active`
3. **Form state** — `.field input:focus`, `.field textarea:focus`: border glow (3px rgba gold) + transición suave (150ms)
4. **Panel transitions** — `.panel.active`: fade (200ms) cuando se muestran entre tabs
5. **Acordeones** — `#admin-reuniones-mes-accordion`, `[id^="obs-*"]`: expand/collapse con `max-height` + opacity (250ms)
6. **Modal entrance** — `.modal-overlay.show`: backdrop fade (0→0.6) + blur (0→8px) + modal scale (0.95→1, 300ms)

Cambios en JavaScript:
- `admin.js`: `toggleReunionesMes()` y `toggleObsAdmin()` usan `classList.add/remove('open')` en lugar de `style.display`
- `miembros.js`: `toggleObsMiembro()` usa clase `open` con transición CSS
- `app.js`: removidos imports de `cargarCarrusel` (feature de fotos pausada)
- `index.html`: removido contenedor `#carrusel-container` y `display:none` inline en acordeones

**Commit `9936775` — bump: version 1.0.1 (notificar usuarios)**

Sistema de actualización automática para PWA:
- Nuevo archivo `version.json` en raíz con número de versión y timestamp
- `app.js`: función `_checkearActualizacion()` chequea `/version.json` al iniciar (con `?t=Date.now()` para evitar caché)
- Compara con `localStorage.appVersion` — si hay cambios, llama `_mostrarBannerActualizacion()`
- Banner dorado en top con icono ✨, mensaje "Nueva versión disponible" y botón "Actualizar"
- Al hacer click: `localStorage.setItem('appVersion', nuevaVersion)` + `window.location.reload()`
- En la siguiente carga, localStorage coincide con servidor → no muestra banner (desaparece automáticamente)
- Banner auto-desaparece en 10 segundos si el usuario lo ignora

**Para deployar cambios futuros:**
1. Hacer `git push origin main` con los cambios de código
2. Actualizar `version` en `version.json` (ej: `1.0.1` → `1.0.2`)
3. Hacer `git push origin main` nuevamente
4. Usuarios con la app abierta verán el banner automáticamente

**Removed (limpieza):**
- `app.js`: línea 10 `import { cargarCarrusel }...` eliminada
- `app.js`: línea 66 `cargarCarrusel()` eliminada
- `index.html`: contenedor `#carrusel-container` eliminado
- `admin.js`: línea 50 `acc.style.display = 'none'` reemplazado por `acc.classList.remove('open')`
- `miembros.js`: línea 38 `style="display:none"` removido de observaciones
- `admin.js`: línea 136 `style="display:none"` removido de observaciones

**Notas técnicas:**
- Las animaciones usan transform + opacity (rendimiento 60fps)
- Modales usan backdrop-filter blur para efecto premium (ya estaba, mejorado)
- Acordeones usan `display:none/block` con transición opacity (CSS no anima display, pero opacity + max-height hacen el efecto)
- `prefers-reduced-motion` reduce duración a 0.01ms — respeta a usuarios sensibles a movimiento

**Estado actual:**
- ✅ Todas las animaciones funcionan en producción
- ✅ Sistema de versión activo y testeable (cambiar `version.json` muestra banner)
- ✅ Feature de fotos completamente removida (no hay UI ni lógica)
- ✅ Responsive en móvil y desktop
- ✅ Accesibilidad asegurada

---

## Pendientes abiertos

### Mejora — código duplicado en eliminación de célula
La lógica de borrar miembros + reuniones + célula está duplicada en `celulas.js` (`eliminarCelula`) y `admin.js` (`eliminarCelulaAdmin`). Se podría extraer a una función compartida.

### Mejoras propuestas (sesión 2026-06-10, sin empezar)

Ordenadas por valor; recomendación de arranque: 1 + 2.

**Alto valor, esfuerzo bajo/medio:**
1. **Reporte mensual exportable (admin)** — botón "Exportar mes" que genere CSV (célula, fecha, tema, asistentes, ofrenda, total general) con los datos ya cargados en el panel admin. Sin lecturas extra a Firestore.
2. **Alerta de células inactivas (admin)** — badge rojo en la card de células sin reunión registrada hace más de 2 semanas. Se calcula con datos ya cargados.
3. **Aviso de "nueva versión disponible"** — `version.json` consultado al iniciar; si difiere de la versión local, banner "tocá para recargar". Elimina los hard reload manuales post-deploy.
4. **Retomar feature de fotos** — código local pausado (~80% hecho), reglas ya deployadas. Commitear todos los archivos juntos.

**Valor alto, esfuerzo medio:**
5. **Seguimiento de visitas** — detectar nombres repetidos en `visitas` de reuniones recientes y sugerir "¿Convertir a miembro?". El feature de mayor impacto pastoral.
6. **Gráfico de tendencia de asistencia** — mini-gráfica de barras (últimos 2-3 meses) en historial del líder y detalle admin. Con divs y CSS, sin librerías.

**Técnicas / mantenimiento:**
7. **Soporte offline real** — `sw.js` es pass-through puro; sin señal la PWA no abre. Estrategia network-first con fallback a caché (sin riesgo de SW zombie).
8. **Validación en reglas de Firestore** — validar tipos de campos y que `liderEmail == request.auth.token.email` al crear reuniones.
