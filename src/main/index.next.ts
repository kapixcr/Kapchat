import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

// Detectar si estamos en desarrollo o producción
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f0f12',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // En desarrollo, cargar desde Next.js dev server
    console.log('🔧 Modo desarrollo: cargando desde Next.js...');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // En producción, cargar desde Next.js build
    // Next.js genera archivos estáticos en .next/out
    const nextPath = path.join(__dirname, '../../.next/standalone');
    const htmlPath = path.join(nextPath, 'index.html');
    
    console.log('📦 Modo producción: cargando desde Next.js build');
    console.log(`Buscando en: ${htmlPath}`);
    
    // Intentar cargar desde diferentes rutas
    const possiblePaths = [
      htmlPath,
      path.join(__dirname, '../../.next/out/index.html'),
      path.join(app.getAppPath(), '.next', 'out', 'index.html'),
    ];

    let loaded = false;
    for (const htmlPath of possiblePaths) {
      if (require('fs').existsSync(htmlPath)) {
        console.log(`✅ Cargando desde: ${htmlPath}`);
        mainWindow.loadFile(htmlPath).catch((err) => {
          console.error(`❌ Error al cargar desde ${htmlPath}:`, err);
        });
        loaded = true;
        break;
      }
    }

    if (!loaded) {
      console.error('❌ No se encontró index.html de Next.js');
      console.error('Rutas intentadas:', possiblePaths);
    }
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

