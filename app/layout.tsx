import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clim Pilot | Operations",
  description: "Pilotage des interventions de nettoyage de climatisations",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
