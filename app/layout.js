import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import PageTransition from "@/components/PageTransition";

export const metadata = {
  title: "Req2Backlog AI",
  description: "Convierte requerimientos en backlog accionable y exportable.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <LanguageProvider>
          <PageTransition>{children}</PageTransition>
        </LanguageProvider>
      </body>
    </html>
  );
}
