"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import RichText from "@/components/RichText";
import InfoTooltip from "@/components/InfoTooltip";
import TopNav from "@/components/TopNav";

async function parsePdf(file) {
  const pdfjs = await import("pdfjs-dist/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  let content = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    content += `${textContent.items.map((item) => item.str).join(" ")}\n`;
  }
  return content;
}

async function parseDocx(file) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export default function PlanPage() {
  const { t, lang } = useLanguage();
  const sampleText =
    lang === "en"
      ? `1. Scope\n- Login with SSO and mandatory MFA.\n- Daily reporting dashboard.\n\n2. Timeline\n- Go-live: 09/30/2024.\n\n3. Security\n- Access audit and 12-month retention.\n\n4. Support\n- SLA response 4 hours.`
      : `1. Alcance\n- Login con SSO y MFA obligatorio.\n- Dashboard de reporting diario.\n\n2. Plazos\n- Go-live: 30/09/2024.\n\n3. Seguridad\n- Auditoría de accesos y retención 12 meses.\n\n4. Soporte\n- SLA respuesta 4 horas.`;
  const [text, setText] = useState("");
  const [version, setVersion] = useState("v1");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [projectMode, setProjectMode] = useState("existing");
  const [flow, setFlow] = useState("ingest");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [compareText, setCompareText] = useState("");
  const [compareVersion, setCompareVersion] = useState("v2");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [compareApplyResult, setCompareApplyResult] = useState(null);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        const data = await response.json();
        const list = data.projects || [];
        setProjects(list);
        if (list.length === 0) {
          setProjectMode("new");
        } else {
          setProjectMode((prev) => (prev === "new" ? "new" : "existing"));
          if (!projectId && list?.[0]?.id) {
            setProjectId(String(list[0].id));
          }
        }
      } catch (err) {
        // Ignore loading failures
      }
    };
    fetchProjects();
  }, [projectId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search || "");
    const mode = String(params.get("tab") || params.get("mode") || "").toLowerCase().trim();
    if (mode === "compare" || mode === "reconcile") {
      setFlow("compare");
    }
  }, []);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      setProjectError(t("Escribe un nombre para el proyecto.", "Enter a project name."));
      return;
    }
    setCreatingProject(true);
    setProjectError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo crear", "Could not create"));
      }
      const data = await response.json();
      const project = data.project;
      if (project?.id) {
        setProjects((prev) => [project, ...prev]);
        setProjectId(String(project.id));
        setNewProjectName("");
        setProjectMode("existing");
      }
    } catch (err) {
      setProjectError(t("No se pudo crear el proyecto.", "Could not create project."));
    } finally {
      setCreatingProject(false);
    }
  };

  const handleFileTo = (setter) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError("");
    setCompareError("");
    try {
      let content = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        content = await parsePdf(file);
      } else if (file.name.toLowerCase().endsWith(".docx")) {
        content = await parseDocx(file);
      } else {
        content = await file.text();
      }
      setter(content.trim());
    } catch (err) {
      const msg = t("No se pudo leer el archivo.", "Could not read the file.");
      if (setter === setCompareText) {
        setCompareError(msg);
      } else {
        setError(msg);
      }
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError(t("Sube o pega un documento.", "Upload or paste a document."));
      return;
    }
    setProjectError("");
    setLoading(true);
    setError("");
    setResult(null);
    setJobId(null);
    setJobStatus(null);
    try {
      let resolvedProjectId = Number(projectId) || null;
      if (projectMode === "new") {
        const name = newProjectName.trim();
        if (!name) {
          setProjectError(t("Escribe un nombre para el proyecto.", "Enter a project name."));
          setLoading(false);
          return;
        }
        const createResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!createResponse.ok) {
          throw new Error(t("No se pudo crear el proyecto.", "Could not create project."));
        }
        const createData = await createResponse.json();
        const project = createData.project;
        if (!project?.id) {
          throw new Error(t("Respuesta inválida al crear proyecto.", "Invalid create project response."));
        }
        resolvedProjectId = Number(project.id);
        setProjects((prev) => [project, ...prev]);
        setProjectId(String(project.id));
        setNewProjectName("");
        setProjectMode("existing");
      }

      const response = await fetch("/api/plan-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          version,
          context,
          projectId: resolvedProjectId,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || t("Error en el servidor", "Server error"));
      }
      const data = await response.json();
      setJobId(data.jobId);
      setJobStatus({ status: data.status || "queued", error: "" });
    } catch (err) {
      setError(err?.message || t("No se pudo generar el backlog.", "Backlog could not be generated."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let alive = true;
    let timer = null;

    const poll = async () => {
      try {
        const response = await fetch(`/api/plan-jobs/${jobId}`);
        const payload = await response.json();
        if (!alive) {
          return;
        }
        if (!response.ok) {
          throw new Error(payload?.error || "No se pudo consultar el estado.");
        }
        const job = payload?.job || {};
        setJobStatus({ status: job.status, error: job.error || "" });
        if (job.status === "done") {
          setResult(job.result || null);
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
        if (job.status === "error") {
          setError(job.error || t("No se pudo generar el backlog.", "Backlog could not be generated."));
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err?.message || t("No se pudo consultar el estado.", "Could not fetch status."));
      }
    };

    poll();
    timer = setInterval(poll, 1500);

    return () => {
      alive = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [jobId, t]);

  const handleCompare = async () => {
    if (!compareText.trim()) {
      setCompareError(t("Sube o pega la nueva versión.", "Upload or paste the new version."));
      return;
    }
    if (!Number(projectId)) {
      setCompareError(t("Selecciona un proyecto existente.", "Select an existing project."));
      return;
    }
    setCompareLoading(true);
    setCompareError("");
    setCompareApplyResult(null);
    try {
      const response = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: compareText, version: compareVersion, projectId: Number(projectId) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || t("Error en el servidor", "Server error"));
      }
      setCompareResult(payload);
    } catch (err) {
      setCompareError(t("No se pudo comparar.", "Could not compare."));
    } finally {
      setCompareLoading(false);
    }
  };

  const handleApply = async () => {
    if (!compareResult?.actions) {
      return;
    }
    setCompareError("");
    try {
      const response = await fetch("/api/reconcile/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: compareResult.actions,
          from_version: compareResult.from_version,
          to_version: compareResult.to_version,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo aplicar.");
      }
      setCompareApplyResult(payload);
    } catch (err) {
      setCompareError(t("No se pudieron aplicar los cambios.", "Could not apply the changes."));
    }
  };

  const flowTabs = useMemo(
    () => [
      { key: "ingest", label: t("Generar backlog", "Generate backlog") },
      { key: "compare", label: t("Actualizar versión", "Update version") },
    ],
    [t],
  );

  return (
    <div className="page">
      <TopNav />

      <section className="section">
        <div className="view-switch" style={{ marginBottom: "14px" }}>
          {flowTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn ${flow === tab.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFlow(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {flow === "ingest" ? (
          <>
            <h2>{t("Sube requerimientos y genera backlog", "Upload requirements and generate backlog")}</h2>
            <p>
              {t(
                "Carga un PDF, DOCX o TXT. La aplicación crea subproyectos, historias y tareas con trazabilidad y preguntas pendientes.",
                "Upload a PDF, DOCX, or TXT. The app creates subprojects, stories, and tasks with traceability and pending questions.",
              )}
            </p>
            <div className="form-grid">
              <div>
                <label>{t("Proyecto", "Project")}</label>
                <div className="segmented" role="tablist" aria-label={t("Modo de proyecto", "Project mode")}>
                  <button
                    type="button"
                    className={`segmented-btn ${projectMode === "existing" ? "active" : ""}`}
                    onClick={() => setProjectMode("existing")}
                    disabled={projects.length === 0}
                  >
                    {t("Usar existente", "Use existing")}
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${projectMode === "new" ? "active" : ""}`}
                    onClick={() => setProjectMode("new")}
                  >
                    {t("Crear nuevo", "Create new")}
                  </button>
                </div>

                {projectMode === "existing" ? (
                  <>
                    <select
                      className="input"
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      disabled={projects.length === 0}
                    >
                      {projects.length === 0 ? (
                        <option value="">{t("No hay proyectos", "No projects yet")}</option>
                      ) : (
                        projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="helper" style={{ marginTop: "10px" }}>
                      {t("O crea un proyecto nuevo en esta pantalla.", "Or create a new project on this screen.")}
                    </p>
                  </>
                ) : (
                  <div style={{ marginTop: "10px" }}>
                    <label>{t("Nombre del proyecto", "Project name")}</label>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <input
                        className="input"
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        placeholder={t("Ej: Ventas y compras de películas", "Ex: Movie sales and purchases")}
                      />
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={handleCreateProject}
                        disabled={creatingProject || !newProjectName.trim()}
                      >
                        {creatingProject ? t("Creando...", "Creating...") : t("Crear", "Create")}
                      </button>
                    </div>
                    {projectError ? <p className="notice">{projectError}</p> : null}
                    <p className="helper">
                      {t("También puedes gestionar proyectos en", "You can also manage projects in")}{" "}
                      <Link href="/projects">{t("Mis proyectos", "My projects")}</Link>.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label>{t("Versión", "Version")}</label>
                <input
                  className="input"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                />
              </div>
              <div>
                <label>{t("Archivo", "File")}</label>
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileTo(setText)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>{t("Contexto para la IA (opcional)", "AI context (optional)")}</label>
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder={t(
                    "Ej: Plataforma interna para gestionar compras/ventas de películas, con catálogo, inventario y facturación.",
                    "Ex: Internal platform to manage movie purchases/sales with catalog, inventory, and billing.",
                  )}
                />
              </div>
              <div>
                <label>{t("Demo rápida", "Quick demo")}</label>
                <button className="btn btn-outline" type="button" onClick={() => setText(sampleText)}>
                  {t("Cargar ejemplo", "Load sample")}
                </button>
              </div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <label>{t("Texto del documento", "Document text")}</label>
              <textarea value={text} onChange={(event) => setText(event.target.value)} />
            </div>
            {error ? <p className="notice">{error}</p> : null}
            <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-ai" onClick={handleSubmit} disabled={loading}>
                {loading ? t("Enviando a cola...", "Queueing...") : t("Generar backlog", "Generate backlog")}
              </button>
              <Link className="btn btn-ghost" href="/projects">
                {t("Mis proyectos", "My projects")}
              </Link>
              {Number(projectId) ? (
                <Link className="btn btn-outline" href={`/projects/${projectId}`}>
                  {t("Abrir proyecto", "Open project")}
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h2>{t("Sube una versión nueva y actualiza el backlog", "Upload a new version and update the backlog")}</h2>
            <p>
              {t(
                "Selecciona un proyecto con documento base. La aplicación detecta cambios y propone crear, actualizar u obsoletar ítems.",
                "Select a project with a baseline document. The app detects changes and proposes create/update/obsolete actions.",
              )}
            </p>
            <div className="form-grid">
              <div>
                <label>{t("Proyecto (existente)", "Project (existing)")}</label>
                <select
                  className="input"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={projects.length === 0}
                >
                  {projects.length === 0 ? (
                    <option value="">{t("No hay proyectos", "No projects yet")}</option>
                  ) : (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label>{t("Versión nueva", "New version")}</label>
                <input
                  className="input"
                  value={compareVersion}
                  onChange={(event) => setCompareVersion(event.target.value)}
                />
              </div>
              <div>
                <label>{t("Archivo", "File")}</label>
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileTo(setCompareText)}
                />
              </div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <label>{t("Texto (v2)", "Text (v2)")}</label>
              <textarea value={compareText} onChange={(event) => setCompareText(event.target.value)} />
            </div>
            {compareError ? <p className="notice">{compareError}</p> : null}
            <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-ai" onClick={handleCompare} disabled={compareLoading}>
                {compareLoading ? t("Comparando...", "Comparing...") : t("Comparar y proponer", "Compare and propose")}
              </button>
              {Number(projectId) ? (
                <Link className="btn btn-outline" href={`/projects/${projectId}`}>
                  {t("Abrir proyecto", "Open project")}
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="section">
        <h2>{t("Resultado", "Result")}</h2>
        {flow === "ingest" ? (
          !result && !jobId ? (
            <p className="helper">
              {t(
                "Aún no hay resultados. Genera el backlog para ver el resumen.",
                "No results yet. Generate the backlog to see the summary.",
              )}
            </p>
          ) : !result && jobId ? (
            <div className="card-grid">
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h3>{t("Generación en segundo plano", "Background generation")}</h3>
                <p className="helper">
                  {t(
                    "Tu backlog está en cola. Puedes navegar por la app: el resultado aparecerá aquí cuando termine.",
                    "Your backlog is queued. You can navigate the app; the result will appear here once finished.",
                  )}
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="badge">
                    {t("Estado", "Status")}: {jobStatus?.status || "queued"}
                  </span>
                  {jobStatus?.error ? <span className="notice" style={{ margin: 0 }}>{jobStatus.error}</span> : null}
                  {Number(projectId) ? (
                    <Link className="btn btn-outline" href={`/projects/${projectId}`}>
                      {t("Abrir proyecto", "Open project")}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="card-grid">
              <div className="card callout">
                <h3>{t("Preguntas para el cliente (prioritario)", "Client questions (priority)")}</h3>
                <p className="helper">
                  {t(
                    "Si algo no está en el documento, se registra aquí para validarlo antes de comprometer fechas o coste.",
                    "If something is not in the document, it is captured here to validate before committing schedule or cost.",
                  )}
                </p>
                <ul>
                  {(result.missing_info || []).length === 0 ? (
                    <li>{t("No hay preguntas pendientes.", "No pending questions.")}</li>
                  ) : (
                    result.missing_info.map((item, index) => (
                      <li key={index}>
                        <strong>{item.priority}:</strong> {item.question}
                        <div className="helper">{item.reason}</div>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <h3>{t("Resumen del documento", "Document summary")}</h3>
                  {Number(projectId) ? (
                    <Link className="btn btn-outline" href={`/projects/${projectId}`}>
                      {t("Abrir proyecto", "Open project")}
                    </Link>
                  ) : null}
                </div>
                {result.summary ? <RichText text={result.summary} /> : <p>{t("Sin resumen", "No summary")}</p>}
                <p className="helper">
                  {t("Items creados", "Items created")}: {result.created}
                </p>
              </div>
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <h3 style={{ margin: 0 }}>{t("Supuestos", "Assumptions")}</h3>
                  <InfoTooltip label={t("Información sobre supuestos", "Info about assumptions")}>
                    <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                      {t("¿Qué significa?", "What does it mean?")}
                    </div>
                    <div>
                      {t(
                        "Los supuestos son condiciones que no aparecen explícitas en el documento, pero ayudan a estimar y estructurar el trabajo. Deben validarse con el cliente antes de comprometer plazos o coste.",
                        "Assumptions are conditions not explicitly stated in the document, but useful to estimate and structure the work. Validate them with the client before committing schedule or cost.",
                      )}
                    </div>
                  </InfoTooltip>
                </div>
                <ul>
                  {(result.assumptions || []).length === 0 ? (
                    <li>{t("No hay supuestos.", "No assumptions.")}</li>
                  ) : (
                    result.assumptions.map((item, index) => <li key={index}>{item}</li>)
                  )}
                </ul>
              </div>
            </div>
          )
        ) : !compareResult ? (
          <p className="helper">{t("Aún no hay comparación.", "No comparison yet.")}</p>
        ) : (
          <div className="card-grid">
            <div className="card callout">
              <h3>{t("Preguntas para el cliente (prioritario)", "Client questions (priority)")}</h3>
              <ul>
                {(compareResult.actions?.questions_for_client || []).length === 0 ? (
                  <li>{t("No hay preguntas pendientes.", "No pending questions.")}</li>
                ) : (
                  compareResult.actions.questions_for_client.map((item, index) => (
                    <li key={index}>
                      <strong>{item.priority}</strong>: {item.question}
                      <div className="helper">{item.reason}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="card">
              <h3>{t("Cambios detectados", "Detected changes")}</h3>
              <ul>
                {(compareResult.changes || []).length === 0 ? (
                  <li>{t("No se detectaron cambios.", "No changes detected.")}</li>
                ) : (
                  compareResult.changes.map((change, index) => (
                    <li key={index}>
                      <strong>{change.change_type}</strong>: {change.summary}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="card">
              <h3>{t("Acciones sugeridas", "Suggested actions")}</h3>
              <p className="helper">{t("Crear", "Create")}: {compareResult.actions?.create_items?.length || 0}</p>
              <p className="helper">{t("Actualizar", "Update")}: {compareResult.actions?.update_items?.length || 0}</p>
              <p className="helper">{t("Obsoletos", "Obsolete")}: {compareResult.actions?.mark_obsolete?.length || 0}</p>
              <p className="helper">
                {t("Preguntas", "Questions")}: {compareResult.actions?.questions_for_client?.length || 0}
              </p>
              <button className="btn btn-primary" type="button" onClick={handleApply}>
                {t("Aplicar al backlog", "Apply to backlog")}
              </button>
              {compareApplyResult ? (
                <p className="helper" style={{ marginTop: "10px" }}>
                  {t("Aplicado", "Applied")}: {compareApplyResult.created} {t("creados", "created")},{" "}
                  {compareApplyResult.updated} {t("actualizados", "updated")}.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>
      <footer className="footer">{t("Req2Backlog AI · Plan", "Req2Backlog AI · Plan")}</footer>
    </div>
  );
}
