"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import TopNav from "@/components/TopNav";

export default function BacklogPage() {
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace("/projects"), 250);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="page">
      <TopNav />
      <section className="section">
        <h2>{t("Backlog integrado en proyectos", "Backlog integrated into projects")}</h2>
        <p className="helper">
          {t(
            "La gestión de tareas se realiza dentro de Mis proyectos (vistas General/Rally/Jira). Te llevamos allí automáticamente.",
            "Task management is now done inside My projects (General/Rally/Jira views). Taking you there automatically.",
          )}
        </p>
        <Link className="btn btn-primary" href="/projects">
          {t("Ir a Mis proyectos", "Go to My projects")}
        </Link>
      </section>
    </div>
  );
}

