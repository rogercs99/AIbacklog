"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import TopNav from "@/components/TopNav";

export default function ImportExportPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        const data = await response.json();
        setProjects(data.projects || []);
        if (!projectId && data.projects?.[0]?.id) {
          setProjectId(String(data.projects[0].id));
        }
      } catch (err) {
        // Ignore
      }
    };
    fetchProjects();
  }, [projectId]);

  const handleDownload = async (type) => {
    setStatus(t("Generando archivo...", "Generating file..."));
    try {
      const query = projectId ? `?projectId=${projectId}` : "";
      const response = await fetch(`/api/export/${type}${query}`);
      if (!response.ok) {
        throw new Error(t("No se pudo generar el CSV.", "Could not generate the CSV."));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = type === "jira" ? "req2backlog_jira.csv" : "req2backlog_rally.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus(t("Descarga lista.", "Download ready."));
    } catch (error) {
      setStatus(t("Error al descargar el archivo.", "Error downloading the file."));
    }
  };

  return (
    <div className="page">
      <TopNav />

      <section className="section">
        <h2>{t("Exporta a Jira o Rally", "Export to Jira or Rally")}</h2>
        <p>
          {t(
            "Descarga un CSV listo para importar. Solo necesitas mapear columnas en el asistente de importación.",
            "Download a CSV ready to import. You just need to map columns in the import wizard.",
          )}
        </p>
        <div className="form-grid" style={{ marginBottom: "16px" }}>
          <div>
            <label>{t("Proyecto", "Project")}</label>
            <select
              className="input"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card-grid">
          <div className="card">
            <h3>Jira CSV</h3>
            <p>
              {t(
                "Incluye subproyectos, historias y tareas con criterios de aceptación.",
                "Includes subprojects, stories, and tasks with acceptance criteria.",
              )}
            </p>
            <button className="btn btn-primary" type="button" onClick={() => handleDownload("jira")}>
              {t("Descargar Jira CSV", "Download Jira CSV")}
            </button>
          </div>
          <div className="card">
            <h3>Rally CSV</h3>
            <p>{t("Columnas genéricas para mapear trabajo y prioridades.", "Generic columns to map work and priorities.")}</p>
            <button className="btn btn-primary" type="button" onClick={() => handleDownload("rally")}>
              {t("Descargar Rally CSV", "Download Rally CSV")}
            </button>
          </div>
        </div>
        {status ? <p className="helper" style={{ marginTop: "12px" }}>{status}</p> : null}
      </section>

      <section className="section">
        <h2>{t("Consejo rápido", "Quick tip")}</h2>
        <div className="notice">
          {t(
            "Jira y Rally permiten importar CSV sin permisos de API. Solo sube el archivo y mapea las columnas externas a los campos de tu proyecto.",
            "Jira and Rally allow CSV import without API permissions. Upload the file and map external columns to your project fields.",
          )}
        </div>
      </section>
      <footer className="footer">{t("Req2Backlog AI · Export", "Req2Backlog AI · Export")}</footer>
    </div>
  );
}
