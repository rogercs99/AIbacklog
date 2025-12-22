"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import Portal from "@/components/Portal";

function countMatches(text, query) {
  if (!query) {
    return 0;
  }
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    return (String(text || "").match(regex) || []).length;
  } catch (error) {
    return 0;
  }
}

export default function DocumentModal({ document, onClose }) {
  const { t } = useLanguage();
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const documentText = document?.text || "";
  const documentId = document?.id || null;

  useEffect(() => {
    setClosing(false);
    setQuery("");
    setCopied(false);
  }, [documentId]);

  const handleRequestClose = () => {
    setClosing(true);
    window.setTimeout(() => {
      onClose?.();
    }, 180);
  };

  const matches = useMemo(
    () => countMatches(documentText, query.trim()),
    [documentText, query],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(documentText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      // Ignore
    }
  };

  if (!document) {
    return null;
  }

  return (
    <Portal>
      <div
        className={`modal-backdrop ${closing ? "closing" : ""}`}
        onClick={handleRequestClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`modal document-modal ${closing ? "closing" : ""}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <h3>
                {t("Documento", "Document")} {document.version || ""} #{document.id}
              </h3>
              <p className="helper">
                {t(
                  "Visualización interna del texto ingestado.",
                  "Internal view of the ingested text.",
                )}
              </p>
            </div>
            <div className="modal-header-actions">
              <button className="btn btn-ghost" type="button" onClick={handleCopy}>
                {copied ? t("Copiado", "Copied") : t("Copiar", "Copy")}
              </button>
              <button className="btn btn-ghost" type="button" onClick={handleRequestClose}>
                {t("Cerrar", "Close")}
              </button>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: "12px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>{t("Buscar dentro del documento", "Search in document")}</label>
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Escribe un término para buscar", "Type a term to search")}
              />
              {query.trim() ? (
                <p className="helper">
                  {t("Coincidencias aproximadas", "Approximate matches")}: {matches}
                </p>
              ) : null}
            </div>
          </div>

          <pre className="document-text">{document.text}</pre>
        </div>
      </div>
    </Portal>
  );
}
