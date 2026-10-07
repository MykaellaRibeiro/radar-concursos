import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Radar Concursos", template: "%s — Radar Concursos" },
  description: "Monitoramento, histórico e inteligência para concursos públicos no Brasil.",
  applicationName: "Radar Concursos",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Radar Concursos",
    title: "Radar Concursos",
    description: "Monitoramento, histórico e inteligência para concursos públicos no Brasil.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
