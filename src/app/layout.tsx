import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
export const metadata: Metadata = { icons: { icon: '/favicon.svg' }, title: 'Colima 2027 | Plataforma institucional', description: 'Administración institucional de usuarios y resultados de lectura reportados por aplicaciones Android.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
