# Compilación para Web

Este proyecto puede compilarse tanto para Electron (aplicación de escritorio) como para Web (navegador).

## Scripts Disponibles

### Desarrollo Web
```bash
npm run dev:web
```
Inicia el servidor de desarrollo de Vite en modo web (puerto 5173).

### Compilación para Web
```bash
npm run build:web
```
Compila la aplicación para producción web. Los archivos se generan en `dist/web/`.

### Vista Previa de Producción Web
```bash
npm run preview:web
```
Sirve los archivos compilados para web localmente para probar la versión de producción.

## Diferencias entre Electron y Web

### Funcionalidades Disponibles

**Solo en Electron:**
- WhatsApp (requiere Node.js para la conexión)
- Email (requiere Node.js para IMAP/SMTP)
- Acceso completo a la API de Kapix sin problemas de CORS

**Disponible en ambos:**
- Chat (Supabase)
- Tareas (con limitaciones de CORS en web)
- Flows
- Agentes
- Configuración

### Routing

- **Electron**: Usa `HashRouter` para compatibilidad con `file://` protocol
- **Web**: Usa `BrowserRouter` para URLs limpias

### API de Kapix

**En desarrollo:**
- Se usa un proxy de Vite configurado automáticamente que redirige `/api/kapix/*` a `https://kpixs.com/api/*`
- Esto evita problemas de CORS durante el desarrollo
- El header de autenticación se agrega automáticamente por el proxy

**En producción (Vercel):**
- Se usa una función serverless (`api/kapix/[...path].ts`) que actúa como proxy
- Esta función maneja CORS automáticamente y agrega el header de autenticación
- Las peticiones van a `/api/kapix/*` que se redirigen a la función serverless

**En producción (otros servidores):**
- Las peticiones van directamente a `https://kpixs.com/api/*`
- Si hay problemas de CORS, necesitarás:
  1. Configurar CORS en el servidor de Kapix para permitir tu dominio
  2. O usar un proxy en tu servidor web (nginx, Apache, etc.)

## Despliegue Web

Después de compilar con `npm run build:web`, los archivos en `dist/web/` pueden ser servidos por cualquier servidor web estático:

### Vercel

El proyecto incluye un archivo `vercel.json` configurado. Para desplegar:

1. Conecta tu repositorio a Vercel
2. Vercel detectará automáticamente la configuración
3. Asegúrate de configurar las variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**Nota**: El archivo `vercel.json` está configurado para:
- Build command: `npm run build:web`
- Output directory: `dist/web`
- Rewrites: Todas las rutas se redirigen a `index.html` para SPA routing

### Otros servicios

- **Netlify**: Arrastra la carpeta `dist/web/` a Netlify o crea un `netlify.toml` similar
- **GitHub Pages**: Configura el directorio de salida como `dist/web` y agrega un `_redirects` file
- **Servidor propio**: Copia `dist/web/` a tu servidor web (nginx, Apache, etc.) y configura rewrite rules

## Variables de Entorno

Asegúrate de configurar las variables de entorno necesarias en tu servidor web o en el archivo `.env`:

- `VITE_SUPABASE_URL`: URL de tu proyecto Supabase
- `VITE_SUPABASE_ANON_KEY`: Clave anónima de Supabase

## Notas Importantes

- Las funcionalidades que requieren Node.js (WhatsApp, Email) no estarán disponibles en la versión web
- La API de Kapix puede requerir configuración de CORS adicional
- Algunas características pueden tener comportamiento diferente entre Electron y Web

