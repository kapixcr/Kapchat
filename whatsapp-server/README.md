# WhatsApp Server para Kapchat

Servidor dedicado de Node.js para manejar conexiones de WhatsApp de forma persistente.

## Características

- ✅ Conexiones persistentes de WhatsApp
- ✅ WebSocket para comunicación en tiempo real
- ✅ API REST para operaciones
- ✅ Almacenamiento de sesión en Supabase
- ✅ Soporte multi-usuario

## Instalación

```bash
cd whatsapp-server
npm install
```

## Configuración

1. Copia `.env.example` a `.env`
2. Configura las variables de entorno:
   - `SUPABASE_URL`: URL de tu proyecto Supabase
   - `SUPABASE_ANON_KEY`: Clave anónima de Supabase
   - `PORT`: Puerto del servidor (default: 3001)
   - `ALLOWED_ORIGINS`: Orígenes permitidos (comma-separated)

## Desarrollo

```bash
npm run dev
```

## Producción

```bash
npm run build
npm start
```

## Despliegue

### Railway
1. Conecta tu repositorio a Railway
2. Configura las variables de entorno
3. Railway ejecutará el servidor automáticamente

### Render
1. Crea un nuevo Web Service
2. Usa `npm start` como comando de inicio
3. Configura las variables de entorno

### VPS (Ubuntu/Debian)
1. Usa PM2 para mantener el proceso activo:
```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name whatsapp-server
pm2 save
pm2 startup
```

## API Endpoints

- `POST /api/whatsapp/connect` - Conectar WhatsApp
- `GET /api/whatsapp/status/:userId` - Obtener estado
- `GET /api/whatsapp/qr` - Obtener QR desde Supabase

## WebSocket Events

- `whatsapp:subscribe` - Suscribirse a eventos de un usuario
- `whatsapp:qr:${userId}` - QR generado
- `whatsapp:ready:${userId}` - Conectado exitosamente
- `whatsapp:message:${userId}` - Nuevo mensaje
- `whatsapp:state:${userId}` - Cambio de estado

