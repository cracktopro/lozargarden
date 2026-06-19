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

Producción: `npm run build` → carpeta `dist/`

## Deploy en Render (GitHub)

1. Sube el repo a GitHub
2. En [Render](https://render.com) → New → **Static Site** → conecta el repo
3. Render detecta `render.yaml` automáticamente:
   - **Build:** `npm install && npm run build`
   - **Publish:** `dist/`
   - Reescritura SPA para rutas `#...`
4. Activa Auth, Firestore y Storage en Firebase
5. En Firebase Console → Authentication → **Authorized domains** → añade tu URL de Render (`*.onrender.com`)

Iconos: fuente en `public/icons/`, se copian a `icons/` (dev) y `dist/icons/` (producción).

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
├── CONTEXT.md
├── public/                 # Archivos estáticos (txt de catálogo)
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
    ├── catalog.js
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

Sin cambios respecto a la versión anterior (ver campos en plantas, diary, containers, treatments, photos). Las fotos se comprimen en el cliente antes de subir (máx. 1280 px, JPEG ~82 %, tope 800 KB) y se guardan en Storage con `downloadUrl`.

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

## Historial de desarrollo

| Fecha | Cambio |
|-------|--------|
| 2025-06-19 | Creación inicial (IndexedDB) |
| 2025-06-19 | Migración a Firebase Auth + Firestore + Storage, Vite, login |
| 2025-06-19 | Fotos: IndexedDB temporal → Firebase Storage (plan Blaze) |

## Depuración

- **Permiso denegado**: revisar reglas Firestore/Storage y que Auth esté activo
- **Catálogos vacíos**: borrar doc `meta/catalogs_initialized` en Firestore y recargar
- **Consola Firebase**: Authentication, Firestore, Storage para ver datos
