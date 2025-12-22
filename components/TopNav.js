"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";

export default function TopNav() {
  const pathname = usePathname() || "/";
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = useMemo(
    () => [
      { href: "/plan", label: t("Plan", "Plan") },
      { href: "/projects", label: t("Mis proyectos", "My projects") },
      { href: "/chat", label: t("Chat IA", "AI chat") },
      { href: "/lab", label: t("Laboratorio", "Lab") },
    ],
    [t],
  );

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <>
      <nav className="topnav" aria-label={t("Navegación principal", "Primary navigation")}>
        <Link href="/" className="logo logo-link" aria-label={t("Ir al inicio", "Go to home")}>
          <BrandMark />
          <div>
            <div className="logo-title">Req2Backlog AI</div>
            <div className="logo-sub">{t("Planificación inteligente", "Intelligent planning")}</div>
          </div>
        </Link>

        <div className="topnav-links" role="navigation">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`topnav-link ${isActive(item.href) ? "active" : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="topnav-actions">
          <LanguageToggle />
          <button
            className="btn btn-ghost topnav-menu-button"
            type="button"
            onClick={() => setMenuOpen(true)}
          >
            {t("Menú", "Menu")}
          </button>
        </div>
      </nav>

      {menuOpen ? <div className="topnav-backdrop" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`topnav-drawer ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
        <div className="topnav-drawer-header">
          <div>
            <div className="badge">Req2Backlog AI</div>
            <div className="helper">{t("Navegación", "Navigation")}</div>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => setMenuOpen(false)}>
            {t("Cerrar", "Close")}
          </button>
        </div>
        <div className="topnav-drawer-links">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`topnav-drawer-link ${isActive(item.href) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}
