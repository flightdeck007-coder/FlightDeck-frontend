import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SettingsModal } from "@/components/SettingsModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlightDeck",
  description: "FlightDeck OS — Weekly Flight Reviews, Waypoints (Rocks), Clearances (To-Dos), Turbulence (Issues), Instrument Panel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
    (function() {
      var k = 'theme';
      var s = typeof localStorage !== 'undefined' && localStorage.getItem(k);
      var d = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var theme = s === 'light' || s === 'dark' ? s : (d ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      var pk = 'themePrimary';
      var pc = typeof localStorage !== 'undefined' && localStorage.getItem(pk);
      if (pc && /^#[0-9A-Fa-f]{6}$/.test(pc)) document.documentElement.style.setProperty('--primary', pc);
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              {children}
              <SettingsModal />
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
