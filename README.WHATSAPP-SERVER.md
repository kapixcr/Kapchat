# Servidor Dedicado de WhatsApp

Este servidor permite que WhatsApp funcione completamente en web, sin las limitaciones de las funciones serverless.

## 🚀 Inicio Rápido

### Desarrollo Local

1. **Instalar dependencias del servidor:**
```bash
cd whatsapp-server
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase:
```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_clave_anonima
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000
```

3. **Iniciar el servidor:**
```bash
npm run dev
```

4. **En otro terminal, iniciar Next.js con el servidor:**
```bash
# Desde la raíz del proyecto
npm run dev:all
```

### Producción

#### Opción 1: Railway (Recomendado)

1. Conecta tu repositorio a [Railway](https://railway.app)
2. Crea un nuevo servicio desde el directorio `whatsapp-server`
3. Configura las variables de entorno:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT` (opcional, default: 3001)
   - `ALLOWED_ORIGINS` (URLs permitidas, separadas por comas)
4. Railway ejecutará automáticamente `npm start`

#### Opción 2: Render

1. Crea un nuevo **Web Service** en [Render](https://render.com)
2. Conecta tu repositorio
3. Configura:
   - **Root Directory**: `whatsapp-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Configura las variables de entorno

#### Opción 3: VPS (Ubuntu/Debian)

1. **Instalar Node.js y PM2:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. **Clonar y configurar:**
```bash
cd /opt
git clone tu-repositorio kapchat
cd kapchat/whatsapp-server
npm install
cp .env.example .env
# Editar .env con tus credenciales
```

3. **Compilar y ejecutar con PM2:**
```bash
npm run build
pm2 start dist/index.js --name whatsapp-server
pm2 save
pm2 startup
```

## 🔧 Configuración en Next.js

Una vez que el servidor esté ejecutándose, configura la variable de entorno en tu aplicación Next.js:

### Desarrollo Local

Crea o edita `.env.local`:
```env
NEXT_PUBLIC_WHATSAPP_SERVER_URL=http://localhost:3001
```

### Producción (Vercel)

En la configuración de Vercel, agrega:
```
NEXT_PUBLIC_WHATSAPP_SERVER_URL=https://tu-servidor-whatsapp.railway.app
```

## 📡 API Endpoints

### POST `/api/whatsapp/connect`
Conecta WhatsApp para un usuario.

**Body:**
```json
{
  "userId": "user-123"
}
```

**Response:**
```json
{
  "connected": false,
  "state": "connecting",
  "message": "Conectando..."
}
```

### GET `/api/whatsapp/status/:userId?`
Obtiene el estado de conexión.

**Response:**
```json
{
  "hasSession": true,
  "isConnected": true,
  "state": "connected"
}
```

### GET `/api/whatsapp/qr`
Obtiene el QR code desde Supabase.

**Response:**
```json
{
  "qrCode": "data:image/png;base64,...",
  "status": "connecting"
}
```

## 🔌 WebSocket Events

El servidor expone eventos WebSocket para comunicación en tiempo real:

### Suscribirse
```javascript
socket.emit('whatsapp:subscribe', 'user-123');
```

### Escuchar QR
```javascript
socket.on('whatsapp:qr:user-123', (qr) => {
  console.log('QR recibido:', qr);
});
```

### Escuchar Conexión
```javascript
socket.on('whatsapp:ready:user-123', (user) => {
  console.log('Conectado:', user);
});
```

### Escuchar Mensajes
```javascript
socket.on('whatsapp:message:user-123', (message) => {
  console.log('Mensaje recibido:', message);
});
```

### Enviar Mensaje
```javascript
socket.emit('whatsapp:send', {
  userId: 'user-123',
  to: '50612345678',
  message: 'Hola!'
});
```

## 🐛 Troubleshooting

### El servidor no inicia
- Verifica que las variables de entorno estén configuradas correctamente
- Asegúrate de que el puerto no esté en uso: `lsof -i :3001`

### No se conecta desde el frontend
- Verifica que `NEXT_PUBLIC_WHATSAPP_SERVER_URL` esté configurado
- Revisa que `ALLOWED_ORIGINS` incluya la URL de tu frontend
- Revisa la consola del navegador para errores de CORS

### WhatsApp no se conecta
- Verifica que Supabase tenga la tabla `whatsapp_session` configurada
- Revisa los logs del servidor para errores específicos
- Asegúrate de que Puppeteer pueda ejecutarse (en VPS puede requerir dependencias adicionales)

## 📝 Notas

- El servidor mantiene conexiones persistentes, a diferencia de las funciones serverless
- La sesión se guarda automáticamente en Supabase
- El servidor soporta múltiples usuarios simultáneos
- En producción, considera usar un proceso manager como PM2 para mantener el servidor activo

