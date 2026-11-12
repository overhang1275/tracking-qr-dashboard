'use client';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/use-auth';
import { TooltipProvider } from '@/components/ui/tooltip';
function Notifications() { const { resolvedTheme } = useTheme(); return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} richColors closeButton position="bottom-right" />; }
export function Providers({ children }: { children: React.ReactNode }) { return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><AuthProvider><TooltipProvider>{children}<Notifications /></TooltipProvider></AuthProvider></ThemeProvider>; }
