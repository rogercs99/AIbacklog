"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import TopNav from "@/components/TopNav";

export default function ProjectsPage() {
  const { t, lang } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [filters, setFilters] = useState({ query: "", withDocs: false, withBacklog: false });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(t("No se pudieron cargar los proyectos.", "Could not load projects."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError(t("Escribe un nombre de proyecto.", "Enter a project name."));
      return;
    }
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo crear", "Could not create"));
      }
      setNewName("");
      await fetchProjects();
    } catch (err) {
      setError(t("No se pudo crear el proyecto.", "Could not create the project."));
    }
  };

  const startEdit = (project) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (projectId) => {
    const name = editingName.trim();
    if (!name) {
      setError(t("El nombre no puede estar vacío.", "Name cannot be empty."));
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo actualizar", "Could not update"));
      }
      cancelEdit();
      await fetchProjects();
    } catch (err) {
      setError(t("No se pudo actualizar el proyecto.", "Could not update the project."));
    }
  };

  const handleDelete = async (project) => {
    if (
      !window.confirm(
        t(
          `¿Eliminar el proyecto \"${project.name}\" y todo su contenido?`,
          `Delete project \"${project.name}\" and all its content?`,
        ),
      )
    ) {
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(t("No se pudo eliminar", "Could not delete"));
      }
      await fetchProjects();
    } catch (err) {
      setError(t("No se pudo eliminar el proyecto.", "Could not delete the project."));
    }
  };

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const nameMatch = project.name
        .toLowerCase()
        .includes(filters.query.trim().toLowerCase());
      const docsMatch = !filters.withDocs || project.documents_count > 0;
      const backlogMatch = !filters.withBacklog || project.backlog_count > 0;
      return nameMatch && docsMatch && backlogMatch;
    });
  }, [projects, filters]);

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(lang === "en" ? "en-US" : "es-ES");
  };

  return (
    <div className="page">
      <TopNav />

      <section className="section">
        <h2>{t("Mis proyectos", "My projects")}</h2>
        <p>{t("Filtra por nombre o por proyectos con documentos y backlog activo.", "Filter by name or by projects with documents and active backlog.")}</p>
        <div className="card" style={{ marginBottom: "16px" }}>
          <h3>{t("Crear proyecto", "Create project")}</h3>
          <div className="form-grid">
            <input
              className="input"
              placeholder={t("Nombre del proyecto", "Project name")}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button className="btn btn-primary" type="button" onClick={handleCreate}>
              {t("Crear", "Create")}
            </button>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label>{t("Buscar", "Search")}</label>
            <input
              className="input"
              placeholder={t("Ej: Proyecto principal", "Ex: Main project")}
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </div>
          <div>
            <label>{t("Filtros rápidos", "Quick filters")}</label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                className={`btn ${filters.withDocs ? "btn-primary" : "btn-ghost"}`}
                type="button"
                onClick={() => setFilters({ ...filters, withDocs: !filters.withDocs })}
              >
                {t("Con documentos", "With documents")}
              </button>
              <button
                className={`btn ${filters.withBacklog ? "btn-primary" : "btn-ghost"}`}
                type="button"
                onClick={() => setFilters({ ...filters, withBacklog: !filters.withBacklog })}
              >
                {t("Con backlog", "With backlog")}
              </button>
            </div>
          </div>
        </div>
        {projects.some((p) => p.pending_plan_jobs > 0) ? (
          <div className="notice" style={{ marginTop: "14px" }}>
            <strong>{t("Se están generando backlogs en segundo plano.", "Backlogs are generating in the background.")}</strong>{" "}
            {t("Puedes seguir navegando; recibirás las tareas cuando terminen.", "You can keep browsing; tasks will appear when finished.")}
          </div>
        ) : null}
      </section>

      <section className="section">
        {loading ? <p className="helper">{t("Cargando...", "Loading...")}</p> : null}
        {error ? <p className="notice">{error}</p> : null}
        {filtered.length === 0 ? (
          <p className="helper">{t("No hay proyectos que coincidan con el filtro.", "No projects match the filter.")}</p>
        ) : (
          <div className="card-grid">
            {filtered.map((project) => (
              <div key={project.id} className="card">
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge">{t("Proyecto", "Project")} #{project.id}</span>
                  {project.pending_plan_jobs > 0 ? (
                    <span className="badge" style={{ background: "rgba(255,179,0,0.16)", color: "#7a4a00" }}>
                      {t("Generando backlog...", "Generating backlog...")}
                    </span>
                  ) : null}
                </div>
                {editingId === project.id ? (
                  <div>
                    <input
                      className="input"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => saveEdit(project.id)}
                      >
                        {t("Guardar", "Save")}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                        {t("Cancelar", "Cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <h3>{project.name}</h3>
                )}
                <p className="helper">
                  {t("Documentos", "Documents")}: {project.documents_count} ·{" "}
                  {t("Backlog", "Backlog")}: {project.backlog_count}
                </p>
                <p className="helper">
                  {t("Última actividad", "Last activity")}: {formatDate(project.last_activity)}
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Link className="btn btn-outline" href={`/projects/${project.id}`}>
                    {t("Explorar proyecto", "Explore project")}
                  </Link>
                  {editingId !== project.id ? (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => startEdit(project)}
                    >
                      {t("Editar", "Edit")}
                    </button>
                  ) : null}
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => handleDelete(project)}
                  >
                    {t("Eliminar", "Delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <footer className="footer">
        {t("Req2Backlog AI · Mis proyectos", "Req2Backlog AI · My projects")}
      </footer>
    </div>
  );
}
