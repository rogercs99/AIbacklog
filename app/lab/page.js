"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import RichText from "@/components/RichText";
import TopNav from "@/components/TopNav";

export default function LabPage() {
  const { t, lang } = useLanguage();
  const sampleText =
    lang === "en"
      ? `Movie project summary\n- Catalog management with DVD, Blu-ray, and digital formats.\n- Supplier purchases with orders and receiving.\n- Customer sales with ticket and invoice.\n- Inventory with minimum stock and alerts.`
      : `Resumen del proyecto de peliculas\n- Gestion de catalogo con formato DVD, Blu-ray y digital.\n- Compras a proveedores con ordenes y recepcion.\n- Ventas a clientes con ticket y factura.\n- Inventario con stock minimo y alertas.`;
  const [contextText, setContextText] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = async () => {
    if (!question.trim()) {
      setError(t("Escribe una pregunta.", "Write a question."));
      return;
    }
    if (!contextText.trim()) {
      setError(t("Pega un texto base para analizar.", "Paste a base text to analyze."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          text: contextText.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(t("Error en el servidor", "Server error"));
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(t("No se pudo responder.", "Could not answer."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <TopNav />

      <section className="section">
        <h2>{t("Chat libre con la IA local", "Free chat with local AI")}</h2>
        <p className="helper">
          {t(
            "Pega cualquier texto, escribe una pregunta y recibe respuesta con citas. No usa proyectos.",
            "Paste any text, ask a question, and receive answers with citations. No projects needed.",
          )}
        </p>
        <div style={{ marginTop: "12px" }}>
          <label>{t("Texto base", "Base text")}</label>
          <textarea
            value={contextText}
            onChange={(event) => setContextText(event.target.value)}
            placeholder={t("Pega aqui tu texto para probar el modelo local.", "Paste text here to test the local model.")}
          />
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setContextText(sampleText)}
            style={{ marginTop: "8px" }}
          >
            {t("Cargar ejemplo", "Load sample")}
          </button>
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>{t("Pregunta", "Question")}</label>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("Ej: Como se manejan las compras a proveedores?", "Ex: How are supplier purchases handled?")}
          />
        </div>
        {error ? <p className="notice">{error}</p> : null}
        <div style={{ marginTop: "16px" }}>
          <button className="btn btn-primary btn-ai" onClick={handleAsk} disabled={loading}>
            {loading ? t("Consultando...", "Asking...") : t("Preguntar", "Ask")}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setResult(null);
              setQuestion("");
              setError("");
            }}
            style={{ marginLeft: "8px" }}
          >
            {t("Limpiar", "Clear")}
          </button>
        </div>
      </section>

      <section className="section">
        <h2>{t("Respuesta", "Answer")}</h2>
        {!result ? (
          <p className="helper">{t("Aún no hay respuesta.", "No answer yet.")}</p>
        ) : (
          <div className="card-grid">
            <div className="card">
              <h3>{t("Respuesta", "Answer")}</h3>
              <RichText text={result.answer} />
              {result.if_not_found ? (
                <p className="helper">{t("No aparece en el texto.", "Not found in the text.")}</p>
              ) : null}
            </div>
            <div className="card">
              <h3>{t("Citas", "Citations")}</h3>
              <ul>
                {(result.citations || []).length === 0 ? (
                  <li>{t("Sin citas.", "No citations.")}</li>
                ) : (
                  result.citations.map((cite, index) => (
                    <li key={index}>
                      <strong>{cite.chunk_id}</strong>: {cite.snippet}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="card">
              <h3>{t("Preguntas sugeridas", "Suggested questions")}</h3>
              <ul>
                {(result.follow_up_questions || []).length === 0 ? (
                  <li>{t("Sin sugerencias.", "No suggestions.")}</li>
                ) : (
                  result.follow_up_questions.map((item, index) => <li key={index}>{item}</li>)
                )}
              </ul>
            </div>
          </div>
        )}
      </section>
      <footer className="footer">
        {t("Req2Backlog AI · Laboratorio local", "Req2Backlog AI · Local lab")}
      </footer>
    </div>
  );
}
