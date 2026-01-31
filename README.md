# Cura360 — Sistema de Gestión Clínica de Heridas

> MVP funcional conectado a Supabase con autenticación real, base de datos real y políticas RLS. Diseño mobile-first, preparado para PWA y Capacitor.

---

## 📋 Contenido

1. [Prerrequisitos](#prerrequisitos)
2. [Setup de Supabase](#setup-de-supabase)
3. [Configuración del Frontend](#configuración-del-frontend)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Modelo de Datos](#modelo-de-datos)
6. [Seguridad (RLS)](#seguridad-rls)
7. [Roles y Acceso](#roles-y-acceso)
8. [Deploy en Netlify](#deploy-en-netlify)
9. [Desarrollo Local](#desarrollo-local)
10. [Escalabilidad](#escalabilidad)

---

## Prerrequisitos

- Cuenta en [Supabase](https://supabase.com) (plan gratuito es suficiente para MVP)
- Cuenta en [Netlify](https://netlify.com) para deploy (opcional para desarrollo local)
- Cualquier servidor estático local (VS Code Live Server, npx serve, etc.)

---

## Setup de Supabase

### 1. Crear proyecto

1. Inicie sesión en [app.supabase.com](https://app.supabase.com)
2. Clic en **New Project**
3. Elija una región cercana a sus usuarios
4. Establezca una contraseña fuerte para la base de datos
5. Espere a que el proyecto se inicialice (~30 segundos)

### 2. Ejecutar el schema SQL

1. En el dashboard de Supabase, vaya a **SQL Editor**
2. Abra el archivo `schema.sql` de este proyecto
3. Copie todo el contenido y péstelo en el editor
4. Clic en **Run** (el botón verde ▶)
5. Verifique que no haya errores. Las tablas y políticas RLS se crean automáticamente.

### 3. Obtener credenciales

1. Vaya a **Settings → API** en su proyecto de Supabase
2. Copie:
   - **Project URL** (ej: `https://abcdefgh.supabase.co`)
   - **anon** key (la clave pública, bajo `Project API keys`)

---

## Configuración del Frontend

### Editar `js/supabase.js`

Abra el archivo `js/supabase.js` y reemplace los dos valores placeholder:

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';  // ← su Project URL
const SUPABASE_KEY  = 'YOUR_ANON_PUBLIC_KEY';                  // ← su anon key
```

> ⚠️ **Importante:** La clave `anon` es pública por diseño. La seguridad real se implementa mediante las políticas RLS en Supabase, no mediante el ocultamiento de esta clave.

---

## Estructura del Proyecto

```
/cura360
├── index.html            # Página de login (entry point)
├── dashboard.html        # Dashboard profesional (SPA-like)
├── paciente.html         # Vista del paciente (solo lectura)
├── schema.sql            # Schema completo + RLS policies
├── manifest.json         # PWA manifest
├── css/
│   ├── variables.css     # Design tokens (colores, espaciado, tipografía)
│   ├── base.css          # Reset + estilos base + toasts
│   ├── layout.css        # Grid, sidebar, bottom nav, topbar
│   └── components.css    # Botones, cards, modales, forms, timeline
├── js/
│   ├── supabase.js       # Cliente Supabase (singleton)
│   ├── router.js         # Utilidades UI: toasts, modales, formateo
│   ├── auth.js           # Login, logout, protección de rutas
│   ├── patients.js       # CRUD pacientes
│   ├── wounds.js         # CRUD heridas
│   └── treatments.js     # CRUD curaciones
├── assets/
│   └── (iconos PWA van aquí)
└── README.md
```

### Convención de scripts

Todos los módulos JS se auto-ejecutan como IIFEs (Immediately Invoked Function Expressions) y exponen sus APIs en el objeto global `window.CURA360`:

```
window.CURA360.supabase    → cliente Supabase
window.CURA360.auth        → { login, logout, getCurrentUser, protectRoute }
window.CURA360.patients    → { create, list, getById }
window.CURA360.wounds      → { create, listByPatient, getById }
window.CURA360.treatments  → { create, listByWound }
window.CURA360.showToast   → (message, type, duration)
window.CURA360.openModal   → (overlayId)
window.CURA360.closeModal  → (overlayId)
```

**Orden de carga** (crítico): `supabase.js` → `router.js` → `auth.js` → módulos de datos

---

## Modelo de Datos

### profiles
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `uuid` | FK → `auth.users.id` |
| `email` | `text` | Correo del usuario |
| `role` | `text` | `professional` o `patient` |

### patients
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `uuid` | PK |
| `name` | `text` | Nombre completo |
| `age` | `smallint` | Edad (0-150) |
| `diagnosis` | `text` | Diagnóstico principal |
| `comorbidities` | `text` | Comorbilidades |
| `professional_id` | `uuid` | FK → `profiles.id` |
| `created_at` | `timestamptz` | Fecha de creación |

### wounds
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `uuid` | PK |
| `patient_id` | `uuid` | FK → `patients.id` |
| `type` | `text` | Tipo de herida |
| `location` | `text` | Ubicación anatómica |
| `dimensions` | `text` | Dimensiones en cm |
| `status` | `text` | `active`, `pending`, `critical`, `closed` |
| `created_at` | `timestamptz` | Fecha de registro |

### treatments
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `uuid` | PK |
| `wound_id` | `uuid` | FK → `wounds.id` |
| `technique` | `text` | Técnica de curación |
| `supplies` | `text` | Insumos utilizados |
| `notes` | `text` | Observaciones clínicas |
| `created_at` | `timestamptz` | Fecha de la curación |

---

## Seguridad (RLS)

Row Level Security es la línea de defensa principal. Cada tabla tiene políticas que filtran automáticamente los datos según el usuario autenticado:

### Profesional
- ✅ **Lee** solo sus propios pacientes (`professional_id = auth.uid()`)
- ✅ **Lee** solo heridas y tratamientos de sus pacientes
- ✅ **Inserta** pacientes con `professional_id` igual a su propio ID
- ✅ **Inserta** heridas y tratamientos solo para sus pacientes

### Paciente
- ✅ **Lee** solo su propia ficha (`patients.id = auth.uid()`)
- ✅ **Lee** solo sus propias heridas y tratamientos
- ❌ No puede insertar ni modificar nada

> **Nota:** Para que un paciente pueda ver sus datos, su `patients.id` debe coincidir con su `auth.uid()`. Esto se configura durante el onboarding (el profesional asigna el ID del usuario al crear el paciente, o se implementa un flujo de invitación en versiones futuras).

---

## Roles y Acceso

### Crear un profesional

1. Registre el usuario en Supabase Auth (desde el dashboard o via API)
2. Ejecute en SQL Editor:
```sql
UPDATE profiles SET role = 'professional' WHERE email = 'profesional@ejemplo.com';
```

### Crear un paciente

1. El profesional crea el paciente desde la app (formulario en dashboard)
2. Para que el paciente acceda a la app:
   - Crear cuenta en Supabase Auth con el mismo email
   - El `profiles.role` será `patient` por defecto (gracias al trigger)
   - **Importante MVP:** El `patients.id` debe actualizarse para coincidir con el `auth.uid()` del paciente, o se implementa búsqueda por otro campo en versiones futuras

---

## Deploy en Netlify

### Método 1: Desde GitHub (recomendado)

1. Sube el proyecto a un repositorio GitHub
2. En Netlify: **New Site → Import project → GitHub**
3. Seleccione su repositorio
4. En **Build settings:** deje vacío (es un sitio estático, no necesita build)
5. Clic **Deploy**
6. Su sitio estará disponible en `https://su-sitio.netlify.app`

### Método 2: Drag & Drop

1. En Netlify dashboard: arrastra la carpeta `/cura360` al área de deploy
2. Listo.

> ⚠️ Asegúrese de que `js/supabase.js` tenga sus credenciales reales antes de hacer deploy.

---

## Desarrollo Local

### Con VS Code Live Server

1. Instale la extensión **Live Server** en VS Code
2. Abra `index.html`
3. Clic derecho → **Go Live**
4. El servidor iniciará en `http://127.0.0.1:5500`

### Con npx (Node.js requerido)

```bash
cd cura360
npx serve .
```

El servidor iniciará en `http://localhost 8000` (verifique la salida de la terminal).

---

## Escalabilidad

Este MVP está arquitectado para crecer sin rehacer:

| Dirección de crecimiento | Qué hacer |
|--------------------------|-----------|
| **App móvil nativa** | Envolver con Capacitor (el HTML/CSS/JS ya es mobile-first) |
| **Más roles** | Agregar valores al `CHECK` constraint de `profiles.role` + nuevas políticas RLS |
| **Imágenes de heridas** | Usar Supabase Storage + una columna `image_url` en `wounds` |
| **Notificaciones** | Usar Supabase Edge Functions + webhooks |
| **Real-time** | Supabase Realtime ya está incluido; agregar `.channel().on()` en los módulos |
| **Más campos** | ALTER TABLE + migración SQL (sin cambios en el frontend base) |
| **Auth social** | Agregar `signInWithOAuth` en `auth.js` (Supabase lo soporta nativamente) |
| **Multiidioma** | Crear archivos `i18n/es.json`, `i18n/en.json` y un módulo `i18n.js` |

---

*Cura360 MVP — Construido con vanilla JS + Supabase. Sin frameworks, sin magia.*
