"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import RichText from "@/components/RichText";
import Portal from "@/components/Portal";

export default function TaskModal({
  item,
  onClose,
  onSave,
  onDelete,
  onOpenChat,
  view,
}) {
  const [draft, setDraft] = useState(item);
  const [closing, setClosing] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [qaList, setQaList] = useState([]);
  const { t } = useLanguage();

  const parseQa = (questions) => {
    const list = Array.isArray(questions) ? questions : [];
    return list.map((entry) => {
      const text = String(entry || "");
      const parts = text.split(/\\s*\\|\\s*A[:=]\\s*/i);
      const question = parts[0].replace(/^Q[:=]\\s*/i, "").trim();
      const answer = parts[1] ? parts[1].trim() : "";
      return { question: question || text, answer };
    });
  };

  useEffect(() => {
    setDraft(item);
    setClosing(false);
    setEditingDescription(false);
    setQaList(parseQa(item?.clarification_questions));
  }, [item]);

  if (!item || !draft) {
    return null;
  }

  const acceptanceCriteria = Array.isArray(draft.acceptance_criteria) ? draft.acceptance_criteria : [];
  const dependencies = Array.isArray(draft.dependencies) ? draft.dependencies : [];
  const risks = Array.isArray(draft.risks) ? draft.risks : [];
  const labels = Array.isArray(draft.labels) ? draft.labels : [];
  const clarificationQuestions = qaList;
  const itemType = String(draft.type || "").toLowerCase();
  const isBlocked = Boolean(draft.blocked_reason);

  const viewContext = String(view || "").toLowerCase();
  const typeLabel = (() => {
    if (itemType === "epic") {
      if (viewContext === "jira") {
        return "Epic";
      }
      if (viewContext === "rally") {
        return t("Iniciativa", "Initiative");
      }
      return t("Subproyecto", "Subproject");
    }
    if (itemType === "story") {
      if (viewContext === "rally") {
        return t("Feature", "Feature");
      }
      if (viewContext === "jira") {
        return "Story";
      }
      return t("Funcionalidad", "Feature");
    }
    if (itemType === "task") {
      if (viewContext === "rally") {
        return t("User Story", "User Story");
      }
      if (viewContext === "jira") {
        return "Task";
      }
      return t("Historia de usuario", "User story");
    }
    return draft.type;
  })();

  const handleRequestClose = () => {
    setClosing(true);
    window.setTimeout(() => {
      onClose?.();
    }, 180);
  };

  return (
    <Portal>
      <div
        className={`modal-backdrop ${closing ? "closing" : ""}`}
        onClick={handleRequestClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`modal ${closing ? "closing" : ""}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <h3>{draft.title}</h3>
              <p className="helper">
                {draft.external_id} · {typeLabel}
                {isBlocked ? ` · ${t("Bloqueada", "Blocked")}` : ""}
              </p>
            </div>
            <div className="modal-header-actions">
              {onOpenChat && itemType !== "epic" ? (
                <button
                  className="btn btn-ghost btn-ai"
                  type="button"
                  onClick={() => onOpenChat(draft)}
                >
                  {t("Preguntar a la IA", "Ask AI")}
                </button>
              ) : null}
              <button className="btn btn-ghost" type="button" onClick={handleRequestClose}>
                {t("Cerrar", "Close")}
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label>{t("Título", "Title")}</label>
              <input
                className="input"
                value={draft.title || ""}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </div>
            <div>
              <label>{t("Estado", "Status")}</label>
              <select
                className="input"
                value={draft.status || "todo"}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                <option value="todo">{t("Por hacer", "To Do")}</option>
                <option value="in_progress">{t("En progreso", "In Progress")}</option>
                <option value="review">{t("Revisión", "Review")}</option>
                <option value="done">{t("Hecho", "Done")}</option>
                <option value="obsolete">{t("Obsoleto", "Obsolete")}</option>
              </select>
            </div>
            <div>
              <label>{t("Prioridad", "Priority")}</label>
              <select
                className="input"
                value={draft.priority || "Medium"}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label>{t("Bloqueo", "Blocking")}</label>
              <select
                className="input"
                value={draft.blocked_reason ? "blocked" : "none"}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "none") {
                    setDraft({ ...draft, blocked_reason: "" });
                  } else if (!draft.blocked_reason) {
                    setDraft({
                      ...draft,
                      blocked_reason: t(
                        "Pendiente de aclaración / dependencias.",
                        "Pending clarification / dependencies.",
                      ),
                    });
                  }
                }}
              >
                <option value="none">{t("Sin bloqueo", "Not blocked")}</option>
                <option value="blocked">{t("Bloqueada", "Blocked")}</option>
              </select>
            </div>
            <div>
              <label>{t("Área", "Area")}</label>
              <select
                className="input"
                value={draft.area || "other"}
                onChange={(event) => setDraft({ ...draft, area: event.target.value })}
              >
                <option value="frontend">frontend</option>
                <option value="backend">backend</option>
                <option value="api">api</option>
                <option value="db">db</option>
                <option value="qa">qa</option>
                <option value="devops">devops</option>
                <option value="security">security</option>
                <option value="other">other</option>
              </select>
            </div>
            {draft.blocked_reason ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <label>{t("Motivo del bloqueo", "Blocking reason")}</label>
                <textarea
                  value={draft.blocked_reason || ""}
                  onChange={(event) => setDraft({ ...draft, blocked_reason: event.target.value })}
                  placeholder={t(
                    "Ej: Dependencia externa, acceso pendiente, información del cliente...",
                    "Ex: External dependency, pending access, client info needed...",
                  )}
                />
              </div>
            ) : null}
            <div style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <label style={{ margin: 0 }}>{t("Descripción", "Description")}</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setEditingDescription((prev) => !prev)}
                  >
                    {editingDescription ? t("Ocultar edición", "Hide editor") : t("Editar", "Edit")}
                  </button>
                  <button
                    className="btn btn-outline btn-ai"
                    type="button"
                    disabled={regenLoading || !item?.id}
                    onClick={async () => {
                      if (!item?.id) return;
                      setRegenLoading(true);
                      setRegenStatus(t("Regenerando descripción...", "Regenerating description..."));
                      try {
                        const response = await fetch(`/api/backlog/${item.id}/regenerate`, {
                          method: "POST",
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data?.error || "No se pudo regenerar.");
                        }
                        const updated = data.item || {};
                        setDraft((prev) => ({
                          ...prev,
                          description: updated.description || prev.description,
                          clarification_questions: updated.clarification_questions || prev.clarification_questions,
                        }));
                        setQaList(parseQa(updated.clarification_questions));
                        setRegenStatus(t("Descripción actualizada.", "Description updated."));
                      } catch (error) {
                        setRegenStatus(t("No se pudo regenerar.", "Could not regenerate."));
                      } finally {
                        setRegenLoading(false);
                        setTimeout(() => setRegenStatus(""), 2200);
                      }
                    }}
                  >
                    {regenLoading ? t("Regenerando...", "Regenerating...") : t("Regenerar descripción", "Regenerate description")}
                  </button>
                </div>
              </div>
              {editingDescription ? (
                <>
                  <textarea
                    value={draft.description || ""}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                  <div style={{ marginTop: "12px" }}>
                    <label>{t("Vista previa", "Preview")}</label>
                    <div className="card" style={{ padding: "12px" }}>
                      {draft.description ? (
                        <RichText text={draft.description} />
                      ) : (
                        <p className="helper">{t("Sin descripcion.", "No description.")}</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card" style={{ padding: "12px" }}>
                  {draft.description ? (
                    <RichText text={draft.description} />
                  ) : (
                    <p className="helper">{t("Sin descripcion.", "No description.")}</p>
                  )}
                </div>
              )}
            </div>
            {regenStatus ? <p className="helper">{regenStatus}</p> : null}
          </div>

          <div className="modal-detail callout">
            <div>
              <strong>{t("Preguntas para el cliente (prioritario)", "Client questions (priority)")}</strong>
              <p className="helper">
                {t(
                  "Primero edita la pregunta (lápiz) y debajo escribe la respuesta. Se guardan en el proyecto.",
                  "Edit the question (pencil) and type the answer below. They are saved in the project.",
                )}
              </p>
              {clarificationQuestions.length === 0 ? (
                <p className="helper">{t("Sin preguntas pendientes.", "No pending questions.")}</p>
              ) : (
                <div className="stack">
                  {clarificationQuestions.map((qa, index) => (
                    <div key={index} className="card" style={{ padding: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                        <label className="helper" style={{ margin: 0 }}>
                          {t("Pregunta", "Question")} #{index + 1}
                        </label>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => {
                            const next = [...clarificationQuestions];
                            const updated = window.prompt(t("Editar pregunta", "Edit question"), qa.question) || qa.question;
                            next[index] = { ...qa, question: updated };
                            setQaList(next);
                          }}
                          aria-label={t("Editar pregunta", "Edit question")}
                        >
                          ✏️
                        </button>
                      </div>
                      <p style={{ marginTop: "4px", fontWeight: 600 }}>{qa.question || t("Pregunta sin texto", "Question with no text")}</p>
                      <label className="helper">{t("Respuesta", "Answer")}</label>
                      <textarea
                        value={qa.answer || ""}
                        onChange={(event) => {
                          const next = [...clarificationQuestions];
                          next[index] = { ...qa, answer: event.target.value };
                          setQaList(next);
                        }}
                        placeholder={t("Escribe la respuesta para el cliente", "Write the answer for the client")}
                      />
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => {
                            const next = clarificationQuestions.filter((_, idx) => idx !== index);
                            setQaList(next);
                          }}
                        >
                          {t("Eliminar", "Delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setQaList((prev) => [...prev, { question: "", answer: "" }])}
                style={{ marginTop: "8px" }}
              >
                {t("Añadir pregunta/respuesta", "Add question/answer")}
              </button>
            </div>
          </div>

          <div className="modal-detail">
            <div>
              <strong>{t("Fuente", "Source")}</strong>
              <p className="helper">{draft.source_chunk_id || "-"}</p>
              <p className="helper">{draft.source_snippet || t("Sin snippet", "No snippet")}</p>
            </div>
            <div>
              <strong>{t("Metadatos", "Metadata")}</strong>
              <p className="helper">{t("Tipo", "Type")}: {draft.type}</p>
              <p className="helper">{t("Puntos", "Points")}: {draft.story_points ?? "-"}</p>
              <p className="helper">{t("Horas", "Hours")}: {draft.estimate_hours ?? "-"}</p>
            </div>
          </div>

          <div className="modal-detail">
            <div>
              <strong>{t("Criterios", "Criteria")}</strong>
              {acceptanceCriteria.length === 0 ? (
                <p className="helper">{t("Sin criterios.", "No criteria.")}</p>
              ) : (
                <ul>
                  {acceptanceCriteria.map((itemText, index) => (
                    <li key={index}>{itemText}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <strong>{t("Dependencias", "Dependencies")}</strong>
              {dependencies.length === 0 ? (
                <p className="helper">{t("Sin dependencias.", "No dependencies.")}</p>
              ) : (
                <ul>
                  {dependencies.map((dep, index) => (
                    <li key={index}>{dep}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <strong>{t("Riesgos", "Risks")}</strong>
              {risks.length === 0 ? (
                <p className="helper">{t("Sin riesgos.", "No risks.")}</p>
              ) : (
                <ul>
                  {risks.map((risk, index) => (
                    <li key={index}>{risk.risk || risk}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <strong>{t("Etiquetas", "Labels")}</strong>
              {labels.length === 0 ? (
                <p className="helper">{t("Sin etiquetas.", "No labels.")}</p>
              ) : (
                <ul>
                  {labels.map((label, index) => (
                    <li key={index}>{label}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                onSave({
                  title: draft.title,
                  status: draft.status,
                  priority: draft.priority,
                  area: draft.area,
                  description: draft.description,
                  blocked_reason: draft.blocked_reason || "",
                  clarification_questions: qaList
                    .map((qa) => {
                      const q = String(qa.question || "").trim();
                      const a = String(qa.answer || "").trim();
                      if (!q && !a) return null;
                      if (!a) return `Q: ${q}`;
                      return `Q: ${q} | A: ${a}`;
                    })
                    .filter(Boolean),
                })
              }
            >
              {t("Guardar cambios", "Save changes")}
            </button>
            <button className="btn btn-outline" type="button" onClick={() => onDelete(draft)}>
              {t("Eliminar", "Delete")}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
