# Kapchat

Sistema de comunicación unificada similar a Slack con integración de WhatsApp y Email.

![Kapchat](https://img.shields.io/badge/version-1.0.0-purple)
![Electron](https://img.shields.io/badge/Electron-28-blue)
![React](https://img.shields.io/badge/React-18-cyan)
![Supabase](https://img.shields.io/badge/Supabase-Database-green)

## Características

- **Chat en tiempo real** - Canales públicos y privados tipo Slack
- **WhatsApp Integration** - Conecta WhatsApp via QR usando Baileys
- **Email SMTP** - Recibe y envía correos de Google Workspace
- **Asignación de Agentes** - Asigna conversaciones a agentes del equipo
- **Interfaz moderna** - UI oscura elegante con animaciones suaves

## Requisitos

- Node.js 18+
- Cuenta de Supabase
- (Opcional) Cuenta de Google Workspace para email

## Instalación

1. **Clonar e instalar dependencias:**

```bash
cd Kapchat
npm install
```

2. **Configurar Supabase:**

   - Crea un nuevo proyecto en [Supabase](https://supabase.com)
   - Ve al SQL Editor y ejecuta el contenido de `supabase/schema.sql`
   - Copia tu URL del proyecto y Anon Key

3. **Configurar variables de entorno:**

```bash
# Copiar el archivo de ejemplo
copy .env.example .env

# Editar .env con tus credenciales
```

Contenido del `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui

# Opcional - Email
VITE_EMAIL_USER=tu-email@empresa.com
VITE_SMTP_HOST=smtp.gmail.com
VITE_SMTP_PORT=587
VITE_IMAP_HOST=imap.gmail.com
VITE_IMAP_PORT=993
```

4. **Iniciar la aplicación:**

```bash
npm run dev
```

5. **Crear cuenta:**
   - La app detectará automáticamente la configuración del .env
   - Crea una cuenta o inicia sesión

## Configuración de Email (Google Workspace)

1. Ve a tu cuenta de Google → Seguridad
2. Activa la verificación en 2 pasos si no está activa
3. Ve a "Contraseñas de aplicaciones"
4. Genera una nueva contraseña para "Correo"
5. Usa esa contraseña en Kapchat (Ajustes → Email)

**Servidores predeterminados:**
- SMTP: smtp.gmail.com:587
- IMAP: imap.gmail.com:993

## Configuración de WhatsApp

1. Ve a la sección WhatsApp en Kapchat
2. Haz clic en "Conectar con QR"
3. Escanea el código QR con tu teléfono:
   - Abre WhatsApp
   - Ve a Configuración → Dispositivos vinculados
   - Escanea el código

## Estructura del Proyecto

```
Kapchat/
├── src/
│   ├── main/                 # Proceso principal de Electron
│   │   ├── index.ts          # Entry point
│   │   ├── preload.ts        # Preload script
│   │   └── services/         # Servicios (WhatsApp, Email, Supabase)
│   └── renderer/             # Interfaz React
│       ├── components/       # Componentes reutilizables
│       ├── pages/            # Páginas de la aplicación
│       ├── store/            # Estado global (Zustand)
│       └── types/            # TypeScript types
├── supabase/
│   └── schema.sql            # Esquema de base de datos
├── package.json
└── README.md
```

## Scripts

```bash
npm run dev        # Desarrollo con hot reload
npm run build      # Build para producción
npm run package    # Empaquetar aplicación
```

## Tecnologías

- **Frontend:** React 18, TypeScript, TailwindCSS
- **Backend:** Electron 28, Node.js
- **Database:** Supabase (PostgreSQL)
- **WhatsApp:** @whiskeysockets/baileys
- **Email:** Nodemailer + IMAP

## Roles de Usuario

| Rol     | Permisos                                              |
|---------|-------------------------------------------------------|
| Admin   | Todo + gestionar agentes y roles                      |
| Agent   | Chat + WhatsApp + Email + asignaciones               |
| User    | Solo chat en canales públicos                        |

## Licencia

MIT © Kapix

