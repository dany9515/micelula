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
assets/
  manifest.json     — PWA manifest
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

## Pendientes abiertos

### Menor — onclick con nombre de célula en admin.js
En `admin.js`, el botón "VER DETALLE" usa `escHtml(c.nombre)` dentro de un atributo `onclick`:
```js
onclick="verDetalleCelula('${c.id}','${escHtml(c.nombre)}')"
```
`escHtml` codifica `'` como `&#39;`, que el HTML parser decodifica a `'` antes de ejecutar el JS. Si un nombre de célula contiene apóstrofe (ej: `Célula O'Brien`), el botón rompería. Solución: migrar a `data-attributes` igual que se hizo con miembros y materiales.

### Menor — bug de timezone en contador de reuniones del admin
En `admin.js`, `cargarPanelAdmin()` hace:
```js
const f = new Date(r.fecha);  // parsea como UTC
if (f.getMonth() === mesActual ...)
```
`new Date("2026-05-01")` se parsea como UTC medianoche. En Argentina (UTC-3) eso es el 30 de abril a las 21:00 local, por lo que `getMonth()` devolvería abril en lugar de mayo. Afecta solo al primer día de cada mes. Solución: parsear la fecha como local: `const [y,m,d] = r.fecha.split('-'); new Date(y, m-1, d)`.

### Mejora — paginación en panel admin
`cargarPanelAdmin()` carga todas las colecciones (`celulas`, `miembros`, `reuniones`) de una vez sin límite. Con muchas células puede ser lento y costoso en lecturas de Firestore.

### Mejora — código duplicado en eliminación de célula
La lógica de borrar miembros + reuniones + célula está duplicada en `celulas.js` (`eliminarCelula`) y `admin.js` (`eliminarCelulaAdmin`). Se podría extraer a una función compartida.
