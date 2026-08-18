import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegistrar } from './pwa-registrar';

export const metadata: Metadata = {
  title: '心流日记 - ADHD 友好的日记本',
  description: '一个为 ADHD 用户设计的极简日记应用，帮助你记录每天的心情与思绪',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '心流日记',
  },
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#9B8EC4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <PwaRegistrar />
      </body>
    </html>
  );
}
