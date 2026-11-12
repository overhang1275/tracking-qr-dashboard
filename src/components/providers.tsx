"use client";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { SettingsProvider } from "@/hooks/use-settings";
import { TooltipProvider } from "@/components/ui/tooltip";
function Notifications() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      containerAriaLabel="Notificaciones"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      closeButton
      position="bottom-right"
    />
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <SettingsProvider>
          <TooltipProvider>
            {children}
            <Notifications />
          </TooltipProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
