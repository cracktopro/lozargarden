# LozarGarden — Contexto del proyecto

Documentación interna para facilitar mantenimiento, correcciones y nuevas funcionalidades.

## Resumen

**LozarGarden** es una aplicación web SPA para gestionar un huerto doméstico con **Firebase** (Auth, Firestore, Storage). Permite login con correo/contraseña, registrar plantas, diario, contenedores, tratamientos y catálogos compartidos. Las fotos se sincronizan en la nube.

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Estructura | HTML5 semántico |
| Estilos | CSS personalizado + Bootstrap 5.3 |
| Lógica | JavaScript ES modules + Vite |
| Auth | Firebase Authentication (email/contraseña) |
| Base de datos | Cloud Firestore (plan Blaze, cuota gratuita) |
| Imágenes | Firebase Storage (`lozargarden.firebasestorage.app`) |
| Fuentes | Google Fonts — Nunito |
| Iconos | Bootstrap Icons |

## Cómo ejecutar

```bash
cd c:\dev\Lozargarden
npm install          # sincroniza iconos public/icons → icons/
npm run dev          # http://localhost:8080
```

**Importante:** usa `npm run dev` (Vite). Si abres la app con otro servidor, ejecuta antes `npm run sync-assets` para copiar los iconos a `/icons/`.

Producción: `npm run build` → carpeta `dist/` (raíz `/`)

GitHub Pages: `npm run build:pages` → `dist/` con base `/lozargarden/`

## Deploy en GitHub Pages

URL de producción: **https://cracktopro.github.io/lozargarden/**

1. El repo está en GitHub (`cracktopro/lozargarden`)
2. En el repo → **Settings → Pages → Build and deployment → Source:** elige **GitHub Actions** (no «Deploy from a branch», que publicaría el código fuente sin compilar)
3. Cada push a `main` ejecuta `.github/workflows/deploy-pages.yml`:
   - `npm ci`
   - `npm run build:pages` (Vite con `base: /lozargarden/`)
   - Publica el contenido de `dist/`
4. Activa Auth, Firestore y Storage en Firebase
5. En Firebase Console → Authentication → **Authorized domains** → añade `cracktopro.github.io`
6. **Storage CORS (obligatorio para subir fotos desde GitHub Pages):** en Cloud Shell, con el proyecto `lozargarden` seleccionado:

```bash
curl -O https://raw.githubusercontent.com/cracktopro/lozargarden/main/storage.cors.json
gcloud storage buckets update gs://lozargarden.firebasestorage.app --cors-file=storage.cors.json
```

Bucket correcto: **`gs://lozargarden.firebasestorage.app`**. Solo hace falta una vez. Si aparece `GcsNotFoundError`, comprueba que Cloud Shell usa el proyecto `lozargarden` (`gcloud config set project lozargarden`).

### Rutas de assets en GitHub Pages

GitHub Pages sirve el sitio en un subdirectorio (`/lozargarden/`), no en la raíz del dominio. Por eso:

- `vite.config.js` usa `base: '/lozargarden/'` en modo `github-pages`
- Los iconos se resuelven con `resolveBaseUrl()` en `js/icons.js` (`import.meta.env.BASE_URL` en Vite, o detección de `/lozargarden/` en el navegador)
- En `index.html` las rutas de iconos son relativas (`icons/...`)

Iconos: fuente en `public/icons/`, se copian a `icons/` (dev) y `dist/icons/` (producción).

Para probar el build de Pages en local: `npm run build:pages` y luego `npx vite preview --mode github-pages`.

## Configuración Firebase (obligatorio)

En [Firebase Console](https://console.firebase.google.com/) → proyecto **lozargarden**:

1. **Authentication** → Sign-in method → activar **Correo/Contraseña**
2. **Firestore Database** → Crear base de datos
3. **Storage** → Activar (requiere plan Blaze)
4. Desplegar reglas:
   - `firestore.rules` → Firestore → Reglas
   - `storage.rules` → Storage → Reglas

Config de la app en `js/firebase.js`.

## Estructura de archivos

```
Lozargarden/
├── index.html
├── package.json
├── vite.config.js
├── firestore.rules
├── storage.rules
├── storage.cors.json       # CORS del bucket (aplicar una vez con gcloud)
├── CONTEXT.md
├── .github/workflows/deploy-pages.yml   # CI: build + deploy a GitHub Pages
├── public/
│   ├── icons/              # Iconos PNG (fuente de verdad)
│   ├── plantas.txt
│   ├── plagas.txt
│   ├── enfermedades.txt
│   └── estados.txt
├── css/kawaii.css
└── js/
    ├── app.js              # Routing + flujo auth
    ├── firebase.js         # Inicialización Firebase
    ├── auth.js             # Login, registro, logout
    ├── db.js               # Capa Firestore + Storage (misma API que antes)
    ├── icons.js            # Rutas de iconos (respeta BASE_URL)
    ├── catalog.js
    ├── plant-states.js       # Niveles, historial y barras de estado/salud
    ├── ui.js
    ├── utils.js
    └── views/
        ├── auth.js         # Pantalla login/registro
        ├── dashboard.js
        ├── plants.js
        ├── diary.js
        ├── containers.js
        ├── treatments.js
        └── catalog-admin.js
```

## Autenticación

- Firebase Auth usa **correo electrónico + contraseña** (mínimo 6 caracteres)
- Pantalla en `js/views/auth.js`
- Tras login se carga la app; datos del huerto son **por usuario** (`users/{uid}/...`)
- Cerrar sesión: botón en menú lateral

## Firestore — estructura

### Catálogos globales (compartidos entre usuarios autenticados)

```
catalogs/plantas/items/{id}
catalogs/plagas/items/{id}
catalogs/enfermedades/items/{id}
catalogs/estados/items/{id}
meta/catalogs_initialized
```

### Datos por usuario

```
users/{uid}/plants/{id}
users/{uid}/diary/{id}
users/{uid}/containers/{id}
users/{uid}/treatments/{id}
users/{uid}/photos/{id}     # metadatos; imagen en Storage
```

### Storage (fotos)

```
users/{uid}/photos/{photoId}
```

### Cuota gratuita Storage (plan Blaze, bucket `*.firebasestorage.app`)

| Concepto | Incluido gratis al mes | A partir de ahí |
|----------|------------------------|-----------------|
| Almacenamiento | **5 GB** totales | ~0,10 $/GB/mes |
| Descargas | **100 GB** | precio Cloud Storage |
| Subidas (operaciones) | **5 000** | precio Cloud Storage |
| Descargas (operaciones) | **50 000** | precio Cloud Storage |

Para un huerto personal: con fotos de ~500 KB, **5 GB ≈ unos 10 000 archivos**. Muy difícil superar la cuota gratis en uso normal. Monitoriza en Firebase Console → Storage → Usage.

## Inicialización de catálogos

En el primer arranque con catálogos vacíos en Firestore:

1. Lee los `.txt` de `/public`
2. Los sube a `catalogs/*/items`
3. Marca `meta/catalogs_initialized = true`

Los cambios en Catálogos se guardan en Firestore. Exportar/Importar `.txt` sigue funcionando.

## Modelos de datos

### Planta (`users/{uid}/plants/{id}`)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | UUID |
| `apodo` | string | Opcional |
| `catalogPlantId` | string | FK → catálogo plantas |
| `containerId` | string \| null | FK → contenedor del usuario |
| `plagaIds` | string[] | FKs → plagas |
| `enfermedadIds` | string[] | FKs → enfermedades |
| `notas` | string | Texto libre |
| `stateHistory` | array | Historial completo de cambios de estado (ver abajo) |
| `progressFromIndex` | number | Índice desde el que se dibuja la barra de progreso (reinicio visual) |
| `specialStates` | object | `{ reposoInvernal, muerta }` |
| `estadoId` | string | Legacy: último estado (sincronizado con el historial) |
| `createdAt` / `updatedAt` | ISO string | |

#### Historial de estados (`stateHistory[]`)

Cada entrada:

| Campo | Tipo |
|-------|------|
| `id` | string |
| `estadoId` | string | FK → `catalogs/estados/items/{id}` |
| `fecha` | string | `YYYY-MM-DD` |
| `hora` | string | `HH:mm` |
| `detalle` | string | Observaciones opcionales |

Al crear una planta no se asigna estado inicial; el usuario lo registra con **Cambiar estado**. Cada entrada del historial se puede **editar** (estado, fecha, hora y detalle) sin borrar el resto del progreso.

#### Sub-estados especiales (`specialStates`)

| Flag | Efecto |
|------|--------|
| `reposoInvernal` | Badge informativo en la tarjeta |
| `muerta` | Badge rojo; bloquea nuevos cambios de estado |

### Catálogo de estados (`catalogs/estados/items/{id}`)

Formato en `public/estados.txt`:

```
nivel|orden|Nombre del estado
```

Ejemplo: `1|1|No germinada`

| Nivel | Grupo |
|-------|-------|
| 1 | Inicio y Siembra |
| 2 | Crecimiento y Establecimiento |
| 3 | Floración y Fructificación |
| 4 | Plenitud y Cosecha |

Estados actuales (14): No germinada, Germinando, Plántula, Plantel, Trasplante reciente, Crecimiento activo, En recuperación, Floración, Fructificación, Maduración, Plenitud, Cosecha.

**Reglas de cambio:** sin estado activo solo nivel 1. En nivel 1 puedes elegir estados de nivel 1 o 2. Desde nivel 2 en adelante también están disponibles los niveles anteriores (regresión) y el siguiente. La barra muestra el ciclo activo desde `progressFromIndex`.

**Barra de salud** (4 segmentos bajo la barra de progreso):

| Nivel | Segmentos pintados | Color |
|-------|-------------------|-------|
| 1 | 1 | Amarillo verdoso |
| 2 | 2 | Verde amarillado |
| 3 | 3 | Verde clarito |
| 4 | 4 | Verde |

### Contenedor (`users/{uid}/containers/{id}`)

Campos: `nombre`, `tipo` (`maceta` \| `jardinera` \| `semillero`), `ubicacion`, `capacidad`, `notas`, `plantIds`, timestamps. Fotos en Storage (`ownerType: "container"`). Capacidad de **semilleros** se muestra en **Celdas**; el resto en **L**.

### Diario, tratamientos, fotos

Sin cambios estructurales relevantes. Tratamientos usan `plantIds[]` (multi-planta). Fotos comprimidas en cliente (ver abajo).

### Compresión de imágenes (`js/image-utils.js`)

| Parámetro | Valor por defecto |
|-----------|-------------------|
| Lado máximo | 1280 px (mantiene proporción) |
| Formato salida | JPEG |
| Calidad inicial | 82 % |
| Tope por foto | 800 KB (baja calidad si hace falta) |
| Tope archivo original | 15 MB (rechaza si es mayor) |

Metadatos guardados en Firestore: `width`, `height`, `bytes`, `originalBytes`.

## Navegación

Rutas por hash: `#dashboard`, `#plants`, `#diary`, `#containers`, `#treatments`, `#catalog`

### UX destacada

- **Tema oscuro:** toggle en el nav lateral (violeta pastel); preferencia en `localStorage` (`lozargarden-theme`)
- **Fotos:** cámara/galería en plantas, diario y contenedores; carrusel modal al pulsar
- **Vista previa cruzada:** clic en planta (desde maceta) o maceta (desde planta) abre modal con tarjeta + editar
- **Estados dinámicos:** barra de progreso + barra de salud + badges en tarjetas de plantas
- **Macetadora:** calculadora de litros integrada en vista Contenedores
- **Tratamientos:** catálogo de productos, selector multi-planta

## Historial de desarrollo

| Fecha | Cambio |
|-------|--------|
| 2025-06-19 | Creación inicial (IndexedDB) |
| 2025-06-19 | Migración a Firebase Auth + Firestore + Storage, Vite, login |
| 2025-06-19 | Fotos: IndexedDB temporal → Firebase Storage (plan Blaze) |
| 2025-06-19 | Deploy en GitHub Pages: base `/lozargarden/`, rutas de iconos con `BASE_URL`, workflow Actions |
| 2025-06-19 | Fotos: botones Cámara/Galería; CORS en Storage para GitHub Pages; errores visibles al guardar |
| 2025-06-19 | Carrusel modal de fotos; sync de fotos corregido (`syncPhotosByOwner`) |
| 2025-06-19 | Catálogo productos/tratamientos; tratamientos multi-planta; badges incidencias |
| 2025-06-19 | Fotos en contenedores; tema oscuro; iconos nav normales |
| 2025-06-19 | Picker plantas en contenedores; modales cruzados planta↔maceta |
| 2025-06-19 | Semilleros: capacidad en Celdas; estados dinámicos con historial y barras |

## Depuración

- **Permiso denegado**: revisar reglas Firestore/Storage y que Auth esté activo
- **Catálogos vacíos**: borrar doc `meta/catalogs_initialized` en Firestore y recargar
- **Estados sin nivel/orden**: reimportar `public/estados.txt` desde Catálogos o borrar `catalogs/estados/items` y `meta/catalogs_initialized`
- **Consola Firebase**: Authentication, Firestore, Storage para ver datos
