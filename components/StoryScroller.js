"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export default function StoryScroller() {
  const { t } = useLanguage();
  const steps = useMemo(
    () => [
      {
        id: "ingest",
        title: t("Carga requisitos de forma sencilla", "Upload requirements smoothly"),
        body: t(
          "Carga el documento y la aplicación lo divide en bloques claros. Cada bloque se guarda para asegurar trazabilidad.",
          "Upload the document and the app splits it into clear blocks. Each block is saved for traceability.",
        ),
        cardTitle: t("Ingesta inteligente", "Smart ingestion"),
        cardDetail: t(
          "PDF, DOCX o texto. Versionado automático y bloques con título.",
          "PDF, DOCX, or text. Auto versioning and titled chunks.",
        ),
      },
      {
        id: "backlog",
        title: t("Backlog listo para trabajar", "Backlog ready to execute"),
        body: t(
          "La IA propone subproyectos, historias y tareas técnicas. Todo con fuente, supuestos y bloqueos identificables.",
          "The AI proposes subprojects, stories, and technical tasks, with sources, assumptions, and blockings you can track.",
        ),
        cardTitle: t("Generación de backlog", "Backlog generation"),
        cardDetail: t(
          "Subproyectos, historias, tareas, estimaciones y criterios de aceptación.",
          "Subprojects, stories, tasks, estimates, and acceptance criteria.",
        ),
      },
      {
        id: "questions",
        title: t("Preguntas antes de comprometer fechas", "Questions before committing dates"),
        body: t(
          "Si falta información, la aplicación lo convierte en preguntas priorizadas para el cliente.",
          "If information is missing, the app turns it into prioritized client questions.",
        ),
        cardTitle: t("Preguntas al cliente", "Client questions"),
        cardDetail: t(
          "Sin suposiciones innecesarias. Preguntas claras con prioridad y motivo.",
          "No guessing. Clear questions with priority and reason.",
        ),
      },
      {
        id: "compare",
        title: t("Versión nueva, backlog vivo", "New version, living backlog"),
        body: t(
          "Carga una v2 y la aplicación propone crear, actualizar o marcar como obsoleto sin perder el historial.",
          "Upload v2 and the app proposes create/update/obsolete without losing history.",
        ),
        cardTitle: t("Reconciliación", "Reconciliation"),
        cardDetail: t(
          "Comparación de cambios + propuesta de acciones antes de aplicar.",
          "Change comparison + action proposal before applying.",
        ),
      },
      {
        id: "export",
        title: t("Export listo para Jira o Rally", "Export ready for Jira or Rally"),
        body: t(
          "Descarga CSV importable y mapea columnas. Sin integraciones ni permisos extra.",
          "Download importable CSV and map columns. No integrations or extra permissions.",
        ),
        cardTitle: t("Export rápido", "Fast export"),
        cardDetail: t(
          "CSV con epic link, criterios, labels y estimaciones.",
          "CSV with epic link, criteria, labels, and estimates.",
        ),
      },
    ],
    [t],
  );

  const stepRefs = useRef({});
  const [activeStep, setActiveStep] = useState(() => steps[0]?.id || "");

  useEffect(() => {
    setActiveStep(steps[0]?.id || "");
  }, [steps]);

  useEffect(() => {
    let frame = null;

    const computeActive = () => {
      frame = null;
      if (!steps.length) {
        return;
      }
      const activationLine = window.innerHeight * 0.35;
      let bestId = steps[0].id;
      let bestDistance = Number.POSITIVE_INFINITY;

      steps.forEach((step) => {
        const el = stepRefs.current[step.id];
        if (!el) {
          return;
        }
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - activationLine);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = step.id;
        }
      });

      setActiveStep(bestId);
    };

    const requestCompute = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(computeActive);
    };

    window.addEventListener("scroll", requestCompute, { passive: true });
    window.addEventListener("resize", requestCompute);
    requestCompute();

    return () => {
      window.removeEventListener("scroll", requestCompute);
      window.removeEventListener("resize", requestCompute);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [steps]);

  const scrollToStep = (stepId) => {
    const el = stepRefs.current[stepId];
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="section story-section" id="story">
      <div className="story-header">
        <div>
          <h2>{t("Recorrido guiado de principio a fin", "Guided walkthrough end to end")}</h2>
          <p>
            {t(
              "Cada paso activa una herramienta real en pantalla. Desplázate y entiende el flujo completo, sin tecnicismos.",
              "Each step activates a real tool on screen. Scroll and understand the full flow, without jargon.",
            )}
          </p>
        </div>
        <span className="badge">Req2Backlog AI</span>
      </div>
      <div className="story-dots" role="tablist" aria-label={t("Progreso", "Progress")}>
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={`story-dot ${activeStep === step.id ? "active" : ""}`}
            onClick={() => scrollToStep(step.id)}
            aria-label={`${t("Paso", "Step")} ${index + 1}: ${step.title}`}
            aria-current={activeStep === step.id ? "step" : undefined}
          />
        ))}
      </div>
      <div className="story-grid">
        <div className="story-steps">
          {steps.map((step, index) => (
            <article
              key={step.id}
              className={`story-step ${activeStep === step.id ? "is-active" : ""}`}
              ref={(el) => {
                if (el) {
                  stepRefs.current[step.id] = el;
                }
              }}
              onClick={() => scrollToStep(step.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  scrollToStep(step.id);
                }
              }}
            >
              <div className="story-index">0{index + 1}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="story-panel">
          <div className="story-cards">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`story-card ${activeStep === step.id ? "is-active" : ""}`}
              >
                <p className="story-kicker">{step.cardTitle}</p>
                <h4>{step.title}</h4>
                <p>{step.cardDetail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
