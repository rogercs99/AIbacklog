"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import RichText from "@/components/RichText";
import TopNav from "@/components/TopNav";

export default function ChatPage() {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        lang === "en"
          ? "Hello. I can answer questions across all your projects. What do you want to find?"
          : "Hola. Puedo responder dudas sobre todos tus proyectos. ¿Qué quieres localizar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setError("");
    setLoading(true);
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    try {
      const response = await fetch("/api/portfolio-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo responder", "Could not respond"));
      }
      const data = await response.json();
      const reply = data.answer || t("Sin respuesta del modelo.", "No model response.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(t("No se pudo responder.", "Could not respond."));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content: t("Conversación reiniciada. ¿En qué puedo ayudarte?", "Conversation reset. How can I help?"),
      },
    ]);
    setInput("");
    setError("");
  };

  return (
    <div className="page">
      <TopNav />

      <section className="section">
        <h2>{t("Chat IA (todos los proyectos)", "AI chat (all projects)")}</h2>
        <p className="helper">
          {t(
            "Pregunta sobre cualquiera de tus proyectos y tareas: la IA usa el contexto local (proyectos, estados y descripciones) para ayudarte a localizar y decidir.",
            "Ask about any project or task: the AI uses local context (projects, statuses, descriptions) to help you locate and decide.",
          )}
        </p>
        <p className="helper">
          {t(
            "Ejemplos: \"¿En qué proyecto hay una tarea de crear películas?\" · \"¿Qué está bloqueado hoy?\"",
            "Examples: \"Which project has a task to create movies?\" · \"What is blocked today?\"",
          )}
        </p>
        <div className="chat-panel" ref={panelRef}>
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`chat-message ${msg.role === "user" ? "user" : "assistant"}`}
            >
              <div className="chat-meta">{msg.role === "user" ? t("Tu", "You") : t("IA", "AI")}</div>
              <div>
                {msg.role === "assistant" ? <RichText text={msg.content} /> : msg.content}
              </div>
            </div>
          ))}
          {loading ? <div className="helper">{t("Escribiendo...", "Typing...")}</div> : null}
        </div>
        <div style={{ marginTop: "16px" }}>
          <label>{t("Tu mensaje", "Your message")}</label>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Escribe aqui tu mensaje", "Write your message here")}
          />
          {error ? <p className="notice">{error}</p> : null}
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button className="btn btn-primary btn-ai" type="button" onClick={sendMessage} disabled={loading}>
              {t("Enviar", "Send")}
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleClear} disabled={loading}>
              {t("Limpiar", "Clear")}
            </button>
          </div>
        </div>
      </section>
      <footer className="footer">
        {t("Req2Backlog AI · Chat IA", "Req2Backlog AI · AI chat")}
      </footer>
    </div>
  );
}
