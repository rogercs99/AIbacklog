"use client";

import Link from "next/link";
import { useMemo } from "react";
import StoryScroller from "@/components/StoryScroller";
import { useLanguage } from "@/components/LanguageProvider";
import TopNav from "@/components/TopNav";

export default function HomePage() {
  const { t } = useLanguage();
  const features = useMemo(
    () => [
      {
        title: t("Backlog estructurado en minutos", "Structured backlog in minutes"),
        body: t(
          "Convierte requerimientos en subproyectos, historias y tareas con estimaciones, criterios de aceptación y trazabilidad.",
          "Turn requirements into subprojects, stories, and tasks with estimates, acceptance criteria, and traceability.",
        ),
      },
      {
        title: t("Trazabilidad y control", "Traceability and control"),
        body: t(
          "Cada tarea incluye su origen y las preguntas pendientes para el cliente, evitando suposiciones innecesarias.",
          "Each task includes its origin and pending client questions, avoiding unnecessary assumptions.",
        ),
      },
      {
        title: t("Gestión de cambios", "Change management"),
        body: t(
          "Carga una nueva versión y la aplicación propone qué crear, actualizar o marcar como obsoleto, con revisión antes de aplicar.",
          "Upload a new version and the app proposes what to create, update, or mark obsolete, with review before applying.",
        ),
      },
      {
        title: t("Exportación lista para importar", "Import-ready exports"),
        body: t(
          "Descarga CSV para importar en Jira o Rally, sin integraciones ni permisos adicionales.",
          "Download CSVs for Jira or Rally, with no integrations or extra permissions.",
        ),
      },
    ],
    [t],
  );

  return (
    <div className="page">
      <TopNav />

      <section className="hero">
        <div>
          <div className="hero-card">
            <div className="hero-tags">
              <span className="tag">Req2Backlog</span>
              <span className="tag">{t("Flujo guiado", "Guided flow")}</span>
              <span className="tag">{t("Trazabilidad", "Traceability")}</span>
            </div>
          <h1>
            {t(
              "Del documento a un plan de trabajo claro y exportable.",
              "From document to a clear, exportable work plan.",
            )}
          </h1>
          <p>
              {t(
                "Sube requerimientos, contratos o alcance y conviértelos en subproyectos y tareas listas para planificación. Obtén una propuesta clara, con criterios de aceptación, estimaciones y preguntas para completar lo que falte.",
                "Upload requirements, contract, or scope and turn them into subprojects and tasks ready for planning. Get a clear proposal with acceptance criteria, estimates, and questions to fill the gaps.",
              )}
          </p>
            <div className="hero-tags">
              <Link className="btn btn-primary" href="/plan">
                {t("Crear plan", "Create plan")}
              </Link>
              <Link className="btn btn-ghost" href="/projects">
                {t("Mis proyectos", "My projects")}
              </Link>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  const section = document.getElementById("story");
                  section?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t("Ver recorrido", "View walkthrough")}
              </button>
              <Link className="btn btn-outline" href="/plan?tab=compare">
                {t("Actualizar versión", "Update version")}
              </Link>
            </div>
          </div>
        </div>
          <div className="hero-card">
            <h2>{t("Casos de uso habituales", "Typical use cases")}</h2>
          <p>
            {t(
              "Cuando llega una nueva versión del documento, el impacto se reparte por equipos. Aquí obtienes una propuesta coherente y revisable para planificar y comunicar.",
              "When a new version arrives, the impact spreads across teams. Here you get a coherent, reviewable proposal to plan and communicate.",
            )}
          </p>
          <div className="card-grid">
            <div className="card">
              <span className="badge">{t("Consultoría", "Consulting")}</span>
              <p>
                {t(
                  "Traducir alcance y criterios en un backlog gestionable.",
                  "Turn scope and criteria into a manageable backlog.",
                )}
              </p>
            </div>
            <div className="card">
              <span className="badge">Delivery</span>
              <p>
                {t(
                  "Actualizar tareas cuando el cliente cambia condiciones o entregables.",
                  "Update tasks when the client changes conditions or deliverables.",
                )}
              </p>
            </div>
            <div className="card">
              <span className="badge">PMO</span>
              <p>
                {t(
                  "Alinear preguntas y riesgos antes de comprometer fechas.",
                  "Align questions and risks before committing dates.",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <StoryScroller />

      <section className="section">
        <h2>{t("Todo en cinco pantallas claras", "Everything in five clear screens")}</h2>
        <div className="card-grid">
          {features.map((item) => (
            <div key={item.title} className="card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="split">
            <div className="card">
            <h3>{t("Empieza por /plan", "Start at /plan")}</h3>
            <p>
              {t(
                "Sube el documento, genera el desglose y guarda todo en la base local. Después entra en Mis proyectos para revisar subproyectos, estados, bloqueos y exportación.",
                "Upload the document, generate the breakdown, and save everything locally. Then open My projects to review subprojects, statuses, blockings, and exports.",
              )}
            </p>
            <Link className="btn btn-outline" href="/plan">
              {t("Ir a plan", "Go to plan")}
            </Link>
          </div>
          <div className="card">
            <h3>{t("Comparaciones controladas", "Controlled comparisons")}</h3>
            <p>
              {t(
                "En Plan puedes cargar una nueva versión. La aplicación propone qué crear, actualizar o marcar como obsoleto, y tú decides qué aplicar.",
                "In Plan you can upload a new version. The app proposes what to create, update, or mark obsolete, and you decide what to apply.",
              )}
            </p>
            <Link className="btn btn-outline" href="/plan?tab=compare">
              {t("Ir a actualización", "Go to update")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        {t(
          "Req2Backlog AI · MVP local (hackathon)",
          "Req2Backlog AI · Local MVP (hackathon)",
        )}
      </footer>
    </div>
  );
}
