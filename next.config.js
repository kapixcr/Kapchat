/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Para Electron, usamos 'export' para generar archivos estáticos
  // Para web/Vercel, podemos usar 'standalone' o dejar por defecto
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
  
  // Configuración de Turbopack (Next.js 16+)
  turbopack: {
    resolveAlias: {
      '@': require('path').resolve(__dirname, './src/renderer'),
    },
  },
  
  // Configuración de webpack (para builds de producción)
  webpack: (config, { isServer }) => {
    // Configuración para Electron - evitar usar módulos de Node.js en el cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      };
    }
    
    // Configurar alias para @/
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, './src/renderer'),
    };
    
    // Ignorar warnings de análisis estático para módulos externos
    config.ignoreWarnings = [
      { module: /node_modules\/clone-deep/ },
      { module: /node_modules\/.*\/utils\.js/ },
      { module: /node_modules\/@wppconnect-team/ },
      { module: /node_modules\/puppeteer/ },
    ];
    
    // Configurar externals para módulos que no deben ser empaquetados en API routes
    if (isServer) {
      config.externals = config.externals || [];
      // No empaquetar Puppeteer y dependencias en serverless
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'puppeteer': 'commonjs puppeteer',
          '@wppconnect-team/wppconnect': 'commonjs @wppconnect-team/wppconnect',
        });
      }
    }
    
    return config;
  },
  
  // Configuración para imágenes y assets
  images: {
    unoptimized: true, // Para Electron y export estático
  },
  
  // Configuración de rutas API
  async rewrites() {
    return [
      {
        source: '/api/kapix/:path*',
        destination: '/api/kapix/:path*',
      },
    ];
  },
  
  // Configuración de transpilación para módulos de Electron y otros
  transpilePackages: ['clone-deep'],
};

module.exports = nextConfig;

