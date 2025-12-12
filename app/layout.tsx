import type { Metadata } from 'next';
import '../src/renderer/styles/index.css';
import { Providers } from './providers';
import { ThemeProvider } from './theme-provider';

export const metadata: Metadata = {
  title: 'Kapchat - Sistema de Comunicación Unificada',
  description: 'Chat, WhatsApp y Email en un solo lugar',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-kap-dark text-white antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

